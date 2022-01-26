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
	DiscordId       string
	Server          string
	Notes           string
	ExpiresAt       time.Time
	Warned          bool
	DirectMessageId string
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

	if config.Timeout == nil {
		timeout := 60
		config.Timeout = &timeout
	}

	if config.Reminder == nil {
		reminder := 5
		config.Reminder = &reminder
	}

	return &DiscordIntegration{
		key:     key,
		config:  config,
		session: session,
		http:    http,
		gcis:    make(map[string]*gciState),
	}
}

func respondWithMessage(w http.ResponseWriter, content string) {
	gores.JSON(w, 200, discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: content,
		},
	})
}

func (d *DiscordIntegration) commandGCISunrise(w http.ResponseWriter, interaction *discordgo.Interaction, options []*discordgo.ApplicationCommandInteractionDataOption, userId string) {
	server := options[0].Value.(string)
	var notes string
	if len(options) > 1 {
		notes = options[1].Value.(string)
	}

	d.RLock()
	state, exists := d.gcis[userId]
	d.RUnlock()
	if exists {
		respondWithMessage(w, fmt.Sprintf("You are already registered as an active GCI on %s", state.Server))
		return
	}

	d.http.Lock()
	_, exists = d.http.sessions[server]
	d.http.Unlock()
	if !exists {
		respondWithMessage(w, fmt.Sprintf("No server named '%s'.", server))
		return
	}

	dm, _ := d.session.UserChannelCreate(userId)

	d.Lock()
	d.gcis[userId] = &gciState{
		DiscordId:       userId,
		Server:          server,
		Notes:           notes,
		ExpiresAt:       time.Now().Add(time.Minute * time.Duration(*d.config.Timeout)),
		DirectMessageId: dm.ID,
	}
	d.save()
	d.Unlock()

	welcome := "You have been marked on-duty as an active GCI, good luck <:blobsalute:357248938933223434>"
	if dm == nil {
		welcome += fmt.Sprintf(
			" (Warning: you have DMs disabled so the bot will not be able to warn you before your GCI session expires. Make sure to /gci refresh every %d minutes!",
			*d.config.Timeout,
		)
	}

	respondWithMessage(w, welcome)
}

func (d *DiscordIntegration) commandGCISunset(w http.ResponseWriter, interaction *discordgo.Interaction, userId string) {
	d.Lock()
	_, ok := d.gcis[userId]
	if !ok {
		respondWithMessage(w, "You are not on-duty as a GCI.")
	} else {
		delete(d.gcis, userId)
		d.save()
		respondWithMessage(w, "You have been marked off-duty. Thanks for your service <:blobsalute:357248938933223434>")
	}
	d.Unlock()

}

func (d *DiscordIntegration) commandGCIRefresh(w http.ResponseWriter, interaction *discordgo.Interaction, userId string) {
	d.Lock()
	gci, ok := d.gcis[userId]
	if !ok {
		respondWithMessage(w, "You are not on-duty as a GCI.")
	} else {
		gci.ExpiresAt = time.Now().Add(time.Minute * time.Duration(*d.config.Timeout))
		gci.Warned = false
		d.save()
		respondWithMessage(w, fmt.Sprintf("Your GCI session has been refreshed for another %d minutes.", *d.config.Timeout))
	}
	d.Unlock()

}

func (d *DiscordIntegration) commandSneakerStatus(
	w http.ResponseWriter,
	interaction *discordgo.Interaction,
	options []*discordgo.ApplicationCommandInteractionDataOption,
) {
	var serverName string
	if len(options) == 0 {
		if len(d.http.config.Servers) > 0 {
			serverName = d.http.config.Servers[0].Name
		} else {
			respondWithMessage(w, fmt.Sprintf("No servers available to GCI on."))
			return
		}
	} else {
		serverName = options[0].Value.(string)
	}

	session, err := d.http.getOrCreateSession(serverName)
	if err != nil {
		respondWithMessage(w, fmt.Sprintf("No server named '%s'.", serverName))
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
		respondWithMessage(w, fmt.Sprintf(
			"%s Status\n**Flying**: %d\n**GCI**: %s\n**Players**: \n```\n%s\n```",
			strings.ToUpper(serverName),
			len(playerList),
			formatGCIList(gcis),
			formatPlayerListTable(playerList),
		))
	}

}

func (d *DiscordIntegration) commandGCIInfo(w http.ResponseWriter, interaction *discordgo.Interaction) {
	d.RLock()
	gcis := []*gciState{}
	for _, gci := range d.gcis {
		gcis = append(gcis, gci)
	}
	d.RUnlock()
	respondWithMessage(w, fmt.Sprintf("**Active GCIs**: %s", formatGCIList(gcis)))
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
				d.commandGCIInfo(w, &interaction)
			case "sunrise":
				d.commandGCISunrise(w, &interaction, data.Options[0].Options, userId)
			case "sunset":
				d.commandGCISunset(w, &interaction, userId)
			case "refresh":
				d.commandGCIRefresh(w, &interaction, userId)
			}
		} else if data.Name == "sneaker-status" {
			d.commandSneakerStatus(w, &interaction, data.Options)
		}
	}

	gores.NoContent(w)
}

// Returns a copy of the GCI list for a given server
func (d *DiscordIntegration) GetGCIList(serverName string) []gciState {
	d.RLock()
	defer d.RUnlock()
	result := []gciState{}
	for _, gci := range d.gcis {
		if gci.Server != serverName {
			continue
		}

		result = append(result, *gci)
	}
	return result
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
					gci.DirectMessageId, "Your GCI session has expired. Please re-sunrise if you are not done yet.",
				)
				if err != nil {
					log.Printf("warning: failed to send GCI expiry warning: %v", err)
					continue
				}
			} else if gci.ExpiresAt.Before(time.Now().Add(time.Minute*time.Duration(*d.config.Reminder))) && !gci.Warned {
				gci.Warned = true

				data := &discordgo.MessageSend{
					Content: fmt.Sprintf(
						"Your GCI session expires in %d minutes! Please /gci refresh if you are not done yet.",
						*d.config.Reminder,
					),
					Components: []discordgo.MessageComponent{
						&discordgo.ActionsRow{
							Components: []discordgo.MessageComponent{
								&discordgo.Button{
									Label:    "Refresh",
									CustomID: fmt.Sprintf("refresh-%v", gci.DiscordId),
									Style:    discordgo.SuccessButton,
								},
							},
						},
					},
				}
				_, err := d.session.ChannelMessageSendComplex(
					gci.DirectMessageId,
					data,
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
