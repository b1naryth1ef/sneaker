# API

## Available Endpoints

### Server List

```
$ curl https://sneaker.example.com/api/servers
[
  {
    "name": "saw",
    "ground_unit_modes": [
      "enemy",
      "friendly"
    ],
    "players": [
      {
        "name": "[TFP] Ghost",
        "type": "F-16C_50"
      },
      {
        "name": "Legacy 1-1 | Zanax116",
        "type": "F-16C_50"
      },
      {
        "name": "Barack 1-1",
        "type": "F-16C_50"
      },
      {
        "name": "Hesgad",
        "type": "Mi-24P"
      }
    ],
    "gcis": [
      {
        "id": "80351110224678912",
        "notes": "asfd",
        "expires_at": "2022-01-26T18:11:50.948081071Z"
      }
    ]
  }
]
```

### Server Information

```
$ curl https://sneaker.example.com/api/servers/saw
{
  "name": "saw",
  "ground_unit_modes": [
    "enemy",
    "friendly"
  ],
  "players": [
    {
      "name": "[TFP] Ghost",
      "type": "F-16C_50"
    },
    {
      "name": "Legacy 1-1 | Zanax116",
      "type": "F-16C_50"
    },
    {
      "name": "Barack 1-1",
      "type": "F-16C_50"
    },
    {
      "name": "Hesgad",
      "type": "Mi-24P"
    }
  ],
  "gcis": [
    {
      "id": "80351110224678912",
      "notes": "asfd",
      "expires_at": "2022-01-26T18:11:50.948081071Z"
    }
  ]
}
```

### Server Events

This is a long-poll SSE HTTP connection.

```
$ curl https://sneaker.example.com/api/servers/saw/events
data: {
  "d": {
    "session_id": "2022-01-26T17:22:03.013Z",
    "offset": 17975,
    "objects": null
  },
  "e": "SESSION_STATE"
}\n\n
data: {
  "d": {
    "updated": [],
    "deleted": [],
    "created": [
      {
        "id": 62210,
        "types": [
          "Ground",
          "Vehicle"
        ],
        "properties": {
          "Coalition": "Enemies",
          "Color": "Blue",
          "Country": "us",
          "Group": "Ground-3",
          "Name": "Patriot AMG",
          "Pilot": "Ground-2-3-1"
        },
        "latitude": 34.5961321,
        "longitude": 32.9832006,
        "altitude": 13.04,
        "heading": 90,
        "updated_at": 17844,
        "created_at": 17844
      }
    ]
  },
  "e": "SESSION_RADAR_SNAPSHOT"
}\n\n
```