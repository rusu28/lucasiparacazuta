export type CartPoleAction = 0 | 1;

export interface CartPoleState {
  x: number;
  xDot: number;
  theta: number;
  thetaDot: number;
}

export interface CartPoleStepResult {
  nextState: CartPoleState;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  actionName: string;
}

const gravity = 9.8;
const massCart = 1.0;
const massPole = 0.1;
const totalMass = massPole + massCart;
const length = 0.5;
const poleMassLength = massPole * length // 2;
const forceMag = 10.0;
const tau = 0.02;
const thetaThresholdRadians = (12 * 2 * Math.PI) / 360;
const xThreshold = 2.4;
const maxEpisodeSteps = 500;

export const cartPoleActionNames = ["left", "right"] as const;

export function createCartPoleState(seed = 0): CartPoleState {
  const wave = (offset: number) => Math.sin((seed + 1) * (offset + 2.37)) * 0.04;
  return {
    x: wave(0),
    xDot: wave(1),
    theta: wave(2),
    thetaDot: wave(3),
  };
}

export function cartPoleObservation(state: CartPoleState): number[] {
  return [state.x, state.xDot, state.theta, state.thetaDot];
}

export function stepCartPole(
  state: CartPoleState,
  action: CartPoleAction,
  steps: number,
): CartPoleStepResult {
  const force = action === 1 ? forceMag : -forceMag;
  const cosTheta = Math.cos(state.theta);
  const sinTheta = Math.sin(state.theta);
  const temp = (force + poleMassLength * state.thetaDot ** 2 * sinTheta) / totalMass;
  const thetaAcc =
    (gravity * sinTheta - cosTheta * temp) /
    (length * (4.0 / 3.0 - (massPole * cosTheta ** 2) / totalMass));
  const xAcc = temp - (poleMassLength * thetaAcc * cosTheta) / totalMass;

  const nextState = {
    x: state.x + tau * state.xDot,
    xDot: state.xDot + tau * xAcc,
    theta: state.theta + tau * state.thetaDot,
    thetaDot: state.thetaDot + tau * thetaAcc,
  };

  const terminated =
    nextState.x < -xThreshold ||
    nextState.x > xThreshold ||
    nextState.theta < -thetaThresholdRadians ||
    nextState.theta > thetaThresholdRadians;
  const truncated = steps + 1 >= maxEpisodeSteps;

  return {
    nextState,
    reward: 1,
    terminated,
    truncated,
    actionName: cartPoleActionNames[action],
  };
}

export function chooseCartPoleHeuristicAction(state: CartPoleState): CartPoleAction {
  return state.theta + 0.35 * state.thetaDot + 0.08 * state.xDot > 0 ? 1 : 0;
}

export function cartPoleScore(state: CartPoleState) {
  return Math.abs(state.theta) * 3 + Math.abs(state.x) * 0.2 + Math.abs(state.thetaDot) * 0.06;
}
