# Sneaker

Sneaker is a **WIP** web-based GCI (Ground Controlled Intercept) interface designed to be used with [Digital Combat Simulator](https://www.digitalcombatsimulator.com/en/) and a server configured with Tacview's [real-time telemetry](https://www.tacview.net/documentation/realtime/en/).

## Server

Sneaker includes a Go server which bundles the frontend UI and a backend server to handle processing of the real-time ACMI telemetry stream from tacview.

## Web Interface

The majority of sneakers features are implemented within the web client based on [maptalks](https://maptalks.org) an excellent and high-performance mapping library. This interface was designed to be primarily used as a GCI and AWACS simulation, so many features are oriented around those domains.

![UI preview](https://i.imgur.com/wkrZ4JU.png)
