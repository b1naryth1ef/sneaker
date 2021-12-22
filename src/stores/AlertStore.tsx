import Immutable from "immutable";
import create from "zustand";
import WarningBeep from "../sounds/warning-beep.mp3";
import { Entity } from "../types/entity";
import { getFlyDistance } from "../util";
import { serverStore } from "./ServerStore";
import { EntityTrackPing, estimatedSpeed, trackStore } from "./TrackStore";

export type Alert = {
  type: string;
  state?: string;

  // The entity id triggering this alert
  targetEntityId: number;
};

type AlertStoreData = {
  alerts: Immutable.Map<number, Immutable.List<Alert>>;
  triggeredEntities: Immutable.Map<number, number>;
};

export const alertStore = create<AlertStoreData>(() => {
  return {
    alerts: Immutable.Map<number, Immutable.List<Alert>>(),
    triggeredEntities: Immutable.Map<number, number>(),
  };
});

(window as any).alertStore = alertStore;

function isTrackInViolation(
  entity: Entity,
  triggerEntity: Entity,
  track: Array<EntityTrackPing> | null,
  radius: number
): boolean {
  const trackVisible = track === null || estimatedSpeed(track) >= 25;
  if (!trackVisible) {
    return false;
  }

  const d0 = Math.floor(
    getFlyDistance(
      [entity.latitude, entity.longitude],
      [triggerEntity.latitude, triggerEntity.longitude]
    )
  );

  return d0 <= radius;
}

export function checkAlerts() {
  const entities = serverStore.getState().entities;
  const trackState = trackStore.getState();

  for (let [entityId, opts] of trackState.trackOptions.entrySeq()) {
    const entity = entities.get(entityId);
    if (!entity || !entity.types.includes("Air")) {
      continue;
    }

    const ourTrack = trackState.tracks.get(entityId);
    if (!ourTrack || estimatedSpeed(ourTrack) < 25) {
      continue;
    }

    if (
      !opts.warningRadius &&
      !opts.threatRadius &&
      !opts.profileThreatRadius &&
      !opts.profileThreatRadius
    ) {
      continue;
    }

    for (const [triggerEntityId, track] of trackState.tracks.entrySeq()) {
      if (triggerEntityId === entity.id) {
        continue;
      }

      const triggerEntity = entities.get(triggerEntityId);
      if (!triggerEntity || triggerEntity.coalition === entity.coalition) {
        continue;
      }

      const warningRadius = opts.warningRadius || opts.profileWarningRadius;
      if (
        warningRadius &&
        isTrackInViolation(entity, triggerEntity, track, warningRadius)
      ) {
        upsertAlert(entityId, {
          type: "warning",
          targetEntityId: triggerEntityId,
        });
      }

      const threatRadius = opts.threatRadius || opts.profileThreatRadius;
      if (
        threatRadius &&
        isTrackInViolation(entity, triggerEntity, track, threatRadius)
      ) {
        upsertAlert(entityId, {
          type: "threat",
          targetEntityId: triggerEntityId,
        });
      }
    }
  }
}

function clearAlerts() {
  alertStore.setState((state) => {
    let result = state.alerts;
    let triggeredEntities = state.triggeredEntities;
    const trackState = trackStore.getState();
    const entities = serverStore.getState().entities;

    for (let [entityId, alerts] of state.alerts) {
      const ourEntity = entities.get(entityId);
      const existingTrack = trackState.tracks.get(entityId);
      if (!existingTrack || !ourEntity || estimatedSpeed(existingTrack) < 25) {
        result = result.remove(entityId);

        for (const alert of alerts) {
          triggeredEntities = decrementTriggeredEntity(
            triggeredEntities,
            alert.targetEntityId
          );
        }

        continue;
      }

      if (!alerts.size) {
        // Leave this around until the entity is deleted
        continue;
      }

      const trackOpts = trackState.trackOptions.get(entityId);
      for (const [index, alert] of alerts.toKeyedSeq()) {
        let radius: number | undefined = undefined;

        const warningRadius =
          trackOpts &&
          (trackOpts.warningRadius || trackOpts.profileWarningRadius);
        const threatRadius =
          trackOpts &&
          (trackOpts.threatRadius || trackOpts.profileThreatRadius);
        if (alert.type === "warning" && warningRadius) {
          radius = warningRadius;
        } else if (alert.type === "threat" && threatRadius) {
          radius = threatRadius;
        }

        if (radius !== undefined) {
          const triggerEntity = entities.get(alert.targetEntityId);
          if (triggerEntity) {
            if (isTrackInViolation(ourEntity, triggerEntity, null, radius)) {
              continue;
            }
          }
        }

        alerts = alerts.remove(index);
        triggeredEntities = decrementTriggeredEntity(
          triggeredEntities,
          alert.targetEntityId
        );
      }

      result = result.set(entityId, alerts);
    }

    return {
      ...state,
      alerts: result,
      triggeredEntities: triggeredEntities,
    };
  });
}

export function deleteAlert(
  entityId: number,
  type: string,
  triggerEntityId: number
) {
  alertStore.setState((state) => {
    let existingAlerts = state.alerts.get(entityId);
    if (!existingAlerts) {
      return;
    }

    let found = false;
    for (const [index, alert] of existingAlerts.entries()) {
      if (alert.type !== type || alert.targetEntityId !== triggerEntityId) {
        continue;
      }

      found = true;
      existingAlerts = existingAlerts.remove(index);
      break;
    }

    if (!found) return;

    return {
      ...state,
      triggeredEntities: decrementTriggeredEntity(
        state.triggeredEntities,
        triggerEntityId
      ),
      alerts: state.alerts.set(entityId, existingAlerts),
    };
  });
}

function incrementTriggeredEntity(
  triggeredEntities: Immutable.Map<number, number>,
  entityId: number
): Immutable.Map<number, number> {
  const existing = triggeredEntities.get(entityId);
  if (!existing) {
    return triggeredEntities.set(entityId, 1);
  }
  return triggeredEntities.set(entityId, existing + 1);
}

function decrementTriggeredEntity(
  triggeredEntities: Immutable.Map<number, number>,
  entityId: number
): Immutable.Map<number, number> {
  const existing = triggeredEntities.get(entityId);
  if (!existing) {
    console.error(
      "decrementTriggeredEntity for non-stored triggered entity",
      entityId
    );
    return triggeredEntities;
  } else if (existing == 1) {
    return triggeredEntities.remove(entityId);
  }
  return triggeredEntities.set(entityId, existing - 1);
}

export function upsertAlert(entityId: number, alert: Alert) {
  alertStore.setState((state) => {
    const alerts = state.alerts;
    let existingAlerts = alerts.get(entityId);
    if (existingAlerts) {
      for (const [index, existing] of existingAlerts.toKeyedSeq()) {
        if (
          existing.type === alert.type &&
          existing.targetEntityId === alert.targetEntityId
        ) {
          if (existing.state === alert.state) {
            // Great, its a noop
            return state;
          }

          existingAlerts = existingAlerts.set(index, alert);
          return {
            ...state,
            alerts: alerts.set(entityId, existingAlerts),
          };
        }
      }

      if (alert.type === "threat") {
        const audio = new Audio(WarningBeep);
        audio.play();
      }

      existingAlerts = existingAlerts.push(alert);

      return {
        ...state,
        triggeredEntities: incrementTriggeredEntity(
          state.triggeredEntities,
          alert.targetEntityId
        ),
        alerts: alerts.set(entityId, existingAlerts),
      };
    }

    if (alert.type === "threat") {
      const audio = new Audio(WarningBeep);
      audio.play();
    }

    return {
      ...state,
      triggeredEntities: incrementTriggeredEntity(
        state.triggeredEntities,
        alert.targetEntityId
      ),
      alerts: alerts.set(entityId, Immutable.List.of(alert)),
    };
  });
}

function loopClearAlerts() {
  try {
    clearAlerts();
    checkAlerts();
  } finally {
    setTimeout(loopClearAlerts, 1000);
  }
}

setTimeout(loopClearAlerts, 5000);
