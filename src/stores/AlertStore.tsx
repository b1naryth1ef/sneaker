import Immutable from "immutable";
import create from "zustand";
import WarningBeep from "../sounds/warning-beep.mp3";
import { getFlyDistance } from "../util";
import { serverStore } from "./ServerStore";
import { estimatedSpeed, trackStore } from "./TrackStore";

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

export function checkAlerts() {
  const entities = serverStore.getState().entities;
  const trackState = trackStore.getState();

  for (const [entityId, opts] of trackState.trackOptions.entrySeq()) {
    const entity = entities.get(entityId);
    if (
      !entity || !entity.types.includes("Air")
    ) {
      continue;
    }

    if (!opts.warningRadius && !opts.threatRadius) {
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

      const trackVisible = estimatedSpeed(track) >= 25;
      if (!trackVisible) {
        continue;
      }

      const d0 = Math.floor(
        getFlyDistance([
          entity.latitude,
          entity.longitude,
        ], [
          triggerEntity.latitude,
          triggerEntity.longitude,
        ]),
      );

      if (opts.warningRadius && d0 <= opts.warningRadius) {
        upsertAlert(entityId, {
          type: "warning",
          targetEntityId: triggerEntityId,
        });
      }

      if (opts.threatRadius && d0 <= opts.threatRadius) {
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
    let resultTriggeredEntities = state.triggeredEntities;
    const trackState = trackStore.getState();
    const entities = serverStore.getState().entities;

    for (let [entityId, alerts] of state.alerts) {
      const ourEntity = entities.get(entityId);
      const existingTrack = trackState.tracks.get(entityId);
      if (!existingTrack || !ourEntity) {
        result = result.remove(entityId);
        continue;
      }

      if (!alerts.size) {
        // Leave this around until the entity is deleted
        continue;
      }

      const trackOpts = trackState.trackOptions.get(entityId);
      for (const [index, alert] of alerts.toKeyedSeq()) {
        let radius: number | undefined = undefined;
        if (alert.type === "warning" && trackOpts?.warningRadius) {
          radius = trackOpts.warningRadius;
        } else if (alert.type === "threat" && trackOpts?.threatRadius) {
          radius = trackOpts.threatRadius;
        }

        if (radius !== undefined) {
          const triggerEntity = entities.get(alert.targetEntityId);
          if (
            triggerEntity
          ) {
            const d0 = getFlyDistance([
              triggerEntity.latitude,
              triggerEntity.longitude,
            ], [
              ourEntity.latitude,
              ourEntity.longitude,
            ]);

            if (
              Math.floor(d0) <= radius
            ) {
              continue;
            }
          }
        }

        alerts = alerts.remove(index);
        resultTriggeredEntities = decrementTriggeredEntity(
          resultTriggeredEntities,
          alert.targetEntityId,
        );
      }

      result = result.set(entityId, alerts);
    }

    return {
      ...state,
      alerts: result,
      triggeredEntities: resultTriggeredEntities,
    };
  });
}

export function deleteAlert(
  entityId: number,
  type: string,
  triggerEntityId: number,
) {
  alertStore.setState((state) => {
    let existingAlerts = state.alerts.get(entityId);
    if (!existingAlerts) {
      return state;
    }

    return {
      ...state,
      triggeredEntities: decrementTriggeredEntity(
        state.triggeredEntities,
        triggerEntityId,
      ),
      alerts: state.alerts.set(
        entityId,
        existingAlerts.filter((it) =>
          it.type !== type && it.targetEntityId !== triggerEntityId
        ),
      ),
    };
  });
}

function incrementTriggeredEntity(
  triggeredEntities: Immutable.Map<number, number>,
  entityId: number,
): Immutable.Map<number, number> {
  const existing = triggeredEntities.get(entityId);
  if (!existing) {
    return triggeredEntities.set(entityId, 1);
  }
  return triggeredEntities.set(entityId, existing + 1);
}

function decrementTriggeredEntity(
  triggeredEntities: Immutable.Map<number, number>,
  entityId: number,
): Immutable.Map<number, number> {
  const existing = triggeredEntities.get(entityId);
  if (!existing) {
    console.error("decrementTriggeredEntity for non-stored triggered entity");
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
          alert.targetEntityId,
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
        alert.targetEntityId,
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
