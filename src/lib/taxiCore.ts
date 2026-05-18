import type { TaxiAgentProfile } from "./types";

export type TaxiAction = 0 | 1 | 2 | 3 | 4 | 5;
export type PassengerIndex = 0 | 1 | 2 | 3 | 4;

export interface TaxiState {
  taxiRow: number;
  taxiCol: number;
  passenger: PassengerIndex;
  destination: 0 | 1 | 2 | 3;
}

export interface TaxiStepResult {
  nextState: TaxiState;
  reward: number;
  done: boolean;
  actionName: string;
}

export const taxiLandmarks = [
  { label: "R", row: 0, col: 0 },
  { label: "G", row: 0, col: 4 },
  { label: "Y", row: 4, col: 0 },
  { label: "B", row: 4, col: 3 },
] as const;

export const actionNames = [
  "south",
  "north",
  "east",
  "west",
  "pickup",
  "dropoff",
] as const;

export function createTaxiState(seed = 0): TaxiState {
  return {
    taxiRow: (seed * 2 + 1) % 5,
    taxiCol: (seed * 3 + 2) % 5,
    passenger: (seed % 4) as 0 | 1 | 2 | 3,
    destination: ((seed + 2) % 4) as 0 | 1 | 2 | 3,
  };
}

export function encodeTaxiObservation(state: TaxiState): number {
  return (
    (((state.taxiRow * 5 + state.taxiCol) * 5 + state.passenger) * 4 +
      state.destination)
  );
}

export function stepTaxi(state: TaxiState, action: TaxiAction): TaxiStepResult {
  const nextState: TaxiState = { ...state };
  let reward = -1;
  let done = false;

  if (action === 0) {
    nextState.taxiRow = Math.min(4, nextState.taxiRow + 1);
  }

  if (action === 1) {
    nextState.taxiRow = Math.max(0, nextState.taxiRow - 1);
  }

  if (action === 2) {
    nextState.taxiCol = Math.min(4, nextState.taxiCol + 1);
  }

  if (action === 3) {
    nextState.taxiCol = Math.max(0, nextState.taxiCol - 1);
  }

  if (action === 4) {
    const passengerSpot = taxiLandmarks[state.passenger as 0 | 1 | 2 | 3];
    if (
      state.passenger !== 4 &&
      passengerSpot.row === state.taxiRow &&
      passengerSpot.col === state.taxiCol
    ) {
      nextState.passenger = 4;
    } else {
      reward = -10;
    }
  }

  if (action === 5) {
    const destinationSpot = taxiLandmarks[state.destination];
    if (
      state.passenger === 4 &&
      destinationSpot.row === state.taxiRow &&
      destinationSpot.col === state.taxiCol
    ) {
      reward = 20;
      done = true;
    } else {
      reward = -10;
    }
  }

  return {
    nextState,
    reward,
    done,
    actionName: actionNames[action],
  };
}

function greedyMove(state: TaxiState, preferColumnFirst: boolean): TaxiAction {
  const target =
    state.passenger === 4
      ? taxiLandmarks[state.destination]
      : taxiLandmarks[state.passenger as 0 | 1 | 2 | 3];

  if (state.taxiRow === target.row && state.taxiCol === target.col) {
    return state.passenger === 4 ? 5 : 4;
  }

  const rowAction: TaxiAction =
    state.taxiRow < target.row ? 0 : state.taxiRow > target.row ? 1 : 0;
  const colAction: TaxiAction =
    state.taxiCol < target.col ? 2 : state.taxiCol > target.col ? 3 : 2;

  if (preferColumnFirst && state.taxiCol !== target.col) {
    return colAction;
  }

  if (!preferColumnFirst && state.taxiRow !== target.row) {
    return rowAction;
  }

  return state.taxiCol !== target.col ? colAction : rowAction;
}

export function chooseLocalAction(
  profile: TaxiAgentProfile,
  state: TaxiState,
  tick: number,
): TaxiAction {
  if (profile.id === "expected_sarsa") {
    return greedyMove(state, true);
  }

  if (profile.id === "mountain_car_reinforce") {
    return greedyMove(state, false);
  }

  if (profile.id === "actor_critic_mountain" && tick % 11 === 0) {
    const target =
      state.passenger === 4
        ? taxiLandmarks[state.destination]
        : taxiLandmarks[state.passenger as 0 | 1 | 2 | 3];
    if (state.taxiCol !== target.col) {
      return state.taxiCol < target.col ? 2 : 3;
    }
  }

  return greedyMove(state, tick % 2 === 0);
}
