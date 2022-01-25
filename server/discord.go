package server

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/alioygur/gores"
	"github.com/bwmarrin/discordgo"
)

type gciState struct {
	DiscordId string
	Server    string
	Notes     string
	ExpiresAt time.Time
	Warned    bool

	dm *discordgo.Channel
}

type DiscordIntegration struct {
	sync.RWMutex

	config  *DiscordIntegrationConfig
	key     ed25519.PublicKey
	session *discordgo.Session
	http    *httpServer

	gcis map[string]*gciState
}

func NewDiscordIntegration(http *httpServer, config *DiscordIntegrationConfig) *DiscordIntegration {
	keyBytes, err := hex.DecodeString(config.ApplicationKey)
	if err != nil {
		log.Panicf("Failed to decode discord application key: %v", err)
	}

	session, err := discordgo.New("Bot " + config.Token)
	if err != nil {
		log.Panicf("Failed to initialize discord session: %v", err)
	}

	key := ed25519.PublicKey(keyBytes)

	return &DiscordIntegration{
		key:     key,
		config:  config,
		session: session,
		http:    http,
		gcis:    make(map[string]*gciState),
	}
}

func (d *DiscordIntegration) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !discordgo.VerifyInteraction(r, d.key) {
		gores.Error(w, 400, "failed to verify request")
		return
	}

	var interaction discordgo.Interaction
	err := json.NewDecoder(r.Body).Decode(&interaction)
	if err != nil {
		gores.Error(w, 400, "failed to decode request")
		return
	}

	if interaction.Type == discordgo.InteractionPing {
		gores.JSON(w, 200, discordgo.InteractionResponse{
			Type: discordgo.InteractionResponsePong,
		})
		return
	} else if interaction.Type == discordgo.InteractionApplicationCommand {
		data := interaction.Data.(discordgo.ApplicationCommandInteractionData)
		var userId string
		if interaction.Member != nil {
			userId = interaction.Member.User.ID
		} else if interaction.User != nil {
			userId = interaction.User.ID
		} else {
			return
		}

		if data.Name == "gci" {
			switch data.Options[0].Name {
			case "info":
				d.RLock()
				gcis := []*gciState{}
				for _, gci := range d.gcis {
					gcis = append(gcis, gci)
				}
				d.RUnlock()
				gores.JSON(w, 200, discordgo.InteractionResponse{
					Type: discordgo.InteractionResponseChannelMessageWithSource,
					Data: &discordgo.InteractionResponseData{
						Content: fmt.Sprintf("**Active GCIs**: %s", formatGCIList(gcis)),
					},
				})
			case "sunrise":
				server := data.Options[0].Options[0].Value.(string)
				var notes string
				if len(data.Options[0].Options) > 1 {
					notes = data.Options[0].Options[1].Value.(string)
				}

				d.RLock()
				state, exists := d.gcis[userId]
				d.RUnlock()
				if exists {
					gores.JSON(w, 200, discordgo.InteractionResponse{
						Type: discordgo.InteractionResponseChannelMessageWithSource,
						Data: &discordgo.InteractionResponseData{
							Content: fmt.Sprintf("You are already registered as an active GCI on %s", state.Server),
						},
					})
					return
				}

				d.http.Lock()
				_, exists = d.http.sessions[server]
				d.http.Unlock()
				if !exists {
					gores.JSON(w, 200, discordgo.InteractionResponse{
						Type: discordgo.InteractionResponseChannelMessageWithSource,
						Data: &discordgo.InteractionResponseData{
							Content: fmt.Sprintf("No server by that name"),
						},
					})
					return
				}

				dm, _ := d.session.UserChannelCreate(userId)

				d.Lock()
				d.gcis[userId] = &gciState{
					DiscordId: userId,
					Server:    server,
					Notes:     notes,
					ExpiresAt: time.Now().Add(time.Minute * 60),
					dm:        dm,
				}
				d.save()
				d.Unlock()

				welcome := "You have been marked on-duty as an active GCI, good luck <:blobsalute:357248938933223434>"
				if dm == nil {
					welcome += " (Warning: you have DMs disabled so the bot will not be able to warn you before your GCI session expires. Make sure to /gci refresh every 60 minutes!"
				}

				gores.JSON(w, 200, discordgo.InteractionResponse{
					Type: discordgo.InteractionResponseChannelMessageWithSource,
					Data: &discordgo.InteractionResponseData{
						Content: welcome,
					},
				})
			case "sunset":
				d.Lock()
				_, ok := d.gcis[userId]
				if !ok {
					gores.JSON(w, 200, discordgo.InteractionResponse{
						Type: discordgo.InteractionResponseChannelMessageWithSource,
						Data: &discordgo.InteractionResponseData{
							Content: "You are not an active GCI!",
						},
					})
				} else {
					delete(d.gcis, userId)
					gores.JSON(w, 200, discordgo.InteractionResponse{
						Type: discordgo.InteractionResponseChannelMessageWithSource,
						Data: &discordgo.InteractionResponseData{
							Content: "You have been marked offline. Thanks for your service <:blobsalute:357248938933223434>",
						},
					})
					d.save()
				}
				d.Unlock()
			case "refresh":
				d.Lock()
				gci, ok := d.gcis[userId]
				if !ok {
					gores.JSON(w, 200, discordgo.InteractionResponse{
						Type: discordgo.InteractionResponseChannelMessageWithSource,
						Data: &discordgo.InteractionResponseData{
							Content: "You are not an active GCI!",
						},
					})
				} else {
					gci.ExpiresAt = time.Now().Add(time.Minute * 60)
					gci.Warned = false
					gores.JSON(w, 200, discordgo.InteractionResponse{
						Type: discordgo.InteractionResponseChannelMessageWithSource,
						Data: &discordgo.InteractionResponseData{
							Content: "Your GCI session has been refreshed for another 60 minutes.",
						},
					})
					d.save()
				}
				d.Unlock()
			}
			return
		} else if data.Name == "sneaker-status" {
			var serverName string
			if len(data.Options) == 0 {
				if len(d.http.config.Servers) > 0 {
					serverName = d.http.config.Servers[0].Name
				} else {
					gores.JSON(w, 200, discordgo.InteractionResponse{
						Type: discordgo.InteractionResponseChannelMessageWithSource,
						Data: &discordgo.InteractionResponseData{
							Content: fmt.Sprintf("No servers available!"),
						},
					})
					return
				}
			} else {
				serverName = data.Options[0].Value.(string)
			}

			session, err := d.http.getOrCreateSession(serverName)
			if err != nil {
				gores.JSON(w, 200, discordgo.InteractionResponse{
					Type: discordgo.InteractionResponseChannelMessageWithSource,
					Data: &discordgo.InteractionResponseData{
						Content: fmt.Sprintf("Hmmm, I couldn't find a server named '%s'", serverName),
					},
				})
			} else {
				d.RLock()
				gcis := []*gciState{}
				for _, gci := range d.gcis {
					if gci.Server == serverName {
						gcis = append(gcis, gci)
					}
				}
				d.RUnlock()

				playerList := session.GetPlayerList()
				gores.JSON(w, 200, discordgo.InteractionResponse{
					Type: discordgo.InteractionResponseChannelMessageWithSource,
					Data: &discordgo.InteractionResponseData{
						Content: fmt.Sprintf(
							"%s Status\n**Flying**: %d\n**GCI**: %s\n**Players**: \n```\n%s\n```",
							strings.ToUpper(serverName),
							len(playerList),
							formatGCIList(gcis),
							formatPlayerListTable(playerList),
						),
					},
				})
			}
			return
		}
	}

	gores.NoContent(w)
}

func formatGCIList(gciList []*gciState) string {
	if len(gciList) == 0 {
		return "none"
	}

	table := []string{}
	for _, gci := range gciList {
		table = append(table, fmt.Sprintf("  <@%s> - %v", gci.DiscordId, gci.Notes))
	}

	return strings.Join(table, "\n")
}

func formatPlayerListTable(playerList []PlayerMetadata) string {
	maxPlayerNameLength := 0
	for _, player := range playerList {
		if len(player.Name) > maxPlayerNameLength {
			maxPlayerNameLength = len(player.Name)
		}
	}

	table := []string{}
	for _, player := range playerList {
		name := player.Name + strings.Repeat(" ", maxPlayerNameLength-len(player.Name))
		table = append(table, fmt.Sprintf("  %v    %v", name, player.Type))
	}

	return strings.Join(table, "\n")
}

// assumes you have a write lock
func (d *DiscordIntegration) save() {
	if d.config.StatePath == nil {
		return
	}

	data, err := json.Marshal(d.gcis)
	if err != nil {
		panic(err)
	}

	err = ioutil.WriteFile(*d.config.StatePath, data, os.ModePerm)
	if err != nil {
		log.Printf("error: failed to save GCI state file: %v", err)
	}
}

func (d *DiscordIntegration) expireLoop() {
	for {
		d.Lock()
		for id, gci := range d.gcis {
			if gci.ExpiresAt.Before(time.Now().Add(time.Second * 10)) {
				delete(d.gcis, id)
				_, err := d.session.ChannelMessageSend(
					gci.dm.ID, "Your GCI session has expired. Please re-sunrise if you are not done yet.",
				)
				if err != nil {
					log.Printf("warning: failed to send GCI expiry warning: %v", err)
					continue
				}
			} else if gci.ExpiresAt.Before(time.Now().Add(time.Minute*5)) && !gci.Warned {
				gci.Warned = true
				_, err := d.session.ChannelMessageSend(
					gci.dm.ID, "Your GCI session expires in 5 minutes! Please /gci refresh if you are not done yet.",
				)
				if err != nil {
					log.Printf("warning: failed to send GCI expiry warning: %v", err)
					continue
				}
			}
		}
		d.save()
		d.Unlock()

		time.Sleep(time.Second * 60)
	}
}

func (d *DiscordIntegration) Setup() error {
	_, err := d.session.ApplicationCommandCreate(d.config.ApplicationID, "", &discordgo.ApplicationCommand{
		Name:        "gci",
		Description: "List and control current GCI status",
		Options: []*discordgo.ApplicationCommandOption{
			{
				Name:        "info",
				Description: "Display information about the active GCI",
				Type:        discordgo.ApplicationCommandOptionSubCommand,
			},
			{
				Name:        "sunrise",
				Description: "Register yourself as an active GCI",
				Type:        discordgo.ApplicationCommandOptionSubCommand,
				Options: []*discordgo.ApplicationCommandOption{
					{
						Name:        "server",
						Description: "server name",
						Type:        discordgo.ApplicationCommandOptionString,
						Required:    true,
					},
					{
						Name:        "notes",
						Description: "Frequencies, coverage details, etc",
						Type:        discordgo.ApplicationCommandOptionString,
						Required:    true,
					},
				},
			},
			{
				Name:        "sunset",
				Description: "Delist yourself as an active GCI",
				Type:        discordgo.ApplicationCommandOptionSubCommand,
				Options:     []*discordgo.ApplicationCommandOption{},
			},
		},
	})
	if err != nil {
		return err
	}

	_, err = d.session.ApplicationCommandCreate(d.config.ApplicationID, "", &discordgo.ApplicationCommand{
		Name:        "status",
		Description: "Lists the current GCIs and players on a given server",
		Options: []*discordgo.ApplicationCommandOption{
			{
				Name:        "server",
				Description: "server name",
				Type:        discordgo.ApplicationCommandOptionString,
			},
		},
	})
	if err != nil {
		return err
	}

	if d.config.StatePath != nil {
		_, err := os.Stat(*d.config.StatePath)

		if err != nil {
			if !os.IsNotExist(err) {
				return err
			}
		} else {
			data, err := ioutil.ReadFile(*d.config.StatePath)
			if err != nil {
				return err
			}
			err = json.Unmarshal(data, &d.gcis)
			if err != nil {
				return err
			}
		}
	}

	go d.expireLoop()
	return nil
}
