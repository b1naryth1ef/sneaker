# Sneaker

Sneaker is a **WIP** web-based radar and GCI simulation software for use with [Digital Combat Simulator](https://www.digitalcombatsimulator.com/en/). Sneaker is based around an emulated radar scope which shows air (and currently sea) targets alongside various metadata (altitude, speed over ground, aircraft type, etc). Sneaker includes some advanced and GCI-specific features such as:

- Configure per-aircraft or profile based threat and warning radius's that provide visual and auditory cues for trespasses.
- Searching, tagging, and watching flights allows you to reduce workload and allow a controller to work across many flights and packages.
- Mission clock and hack timers for command and coordination.

An example of Sneaker can be viewed [here](https://hoggit.brrt.me/).

## Server

Sneaker features a backend server which connects to a TacView real-time server and process the stream of simulation data. Events are pushed via SSE to frontend clients at a configurable radar refresh rate.

## Web UI

The Sneaker web UI presents an emulated radar scope over top a [Open Street Map](https://openstreetmap.org) rendered via [maptalks](https://maptalks.org). The web UI is updated at a configurable simulated refresh rate (by default 5 seconds).

### Bullseye

Bullseye information for the current cursor position is displayed in the bottom right corner of the screen, additionally the bullseye icon is rendered in its position on the map.

### BRAA

A BRAA line can be drawn by right clicking anywhere on the map and dragging. Additionally if you press the "s" (snap) key while starting the BRAA line on-top of an existing track the starting point will be locked to the tracks position.

### Mission Timer & Hack Timers

The mission timer is available in the bottom left corner. Clicking on the timer will create a new hack timer which will display above. 

![UI preview](https://i.imgur.com/wkrZ4JU.png)
