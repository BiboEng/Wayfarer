import { createNotificationResponder, readButtonTap, type TourControls } from '../notification-commands';
import { TOUR_ACTIONS, TOUR_NOTIFICATION_ID } from '../notification-content';

function setup(running = true) {
  const controls = {
    pause: jest.fn(),
    resume: jest.fn(),
    end: jest.fn(),
    isRunning: jest.fn(() => running),
    dismiss: jest.fn(),
  } satisfies TourControls;
  return { controls, respond: createNotificationResponder(controls) };
}

const tap = (actionIdentifier: string, date = 1000, identifier: string = TOUR_NOTIFICATION_ID) => ({
  actionIdentifier,
  notification: { date, request: { identifier } },
});

describe('createNotificationResponder', () => {
  it('maps pause, resume and stop', () => {
    const t = setup();
    t.respond(tap(TOUR_ACTIONS.pause, 1));
    t.respond(tap(TOUR_ACTIONS.resume, 2));
    t.respond(tap(TOUR_ACTIONS.stop, 3));
    expect(t.controls.pause).toHaveBeenCalledTimes(1);
    expect(t.controls.resume).toHaveBeenCalledTimes(1);
    expect(t.controls.end).toHaveBeenCalledTimes(1);
  });

  it('handles a tap once even when delivered twice (task and listener)', () => {
    const t = setup();
    t.respond(tap(TOUR_ACTIONS.pause));
    t.respond(tap(TOUR_ACTIONS.pause));
    expect(t.controls.pause).toHaveBeenCalledTimes(1);
  });

  it('a later tap on a re-posted notification (new date) runs again', () => {
    const t = setup();
    t.respond(tap(TOUR_ACTIONS.pause, 1));
    t.respond(tap(TOUR_ACTIONS.pause, 2));
    expect(t.controls.pause).toHaveBeenCalledTimes(2);
  });

  it('a tap with no running tour dismisses the notification and runs no command', () => {
    const t = setup(false);
    t.respond(tap(TOUR_ACTIONS.resume));
    expect(t.controls.dismiss).toHaveBeenCalledTimes(1);
    expect(t.controls.resume).not.toHaveBeenCalled();
    expect(t.controls.end).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['string', 'x'],
    ['body tap (default action)', tap('expo.modules.notifications.actions.DEFAULT')],
    ['other notification', tap(TOUR_ACTIONS.stop, 1, 'someone-else')],
    ['no notification', { actionIdentifier: TOUR_ACTIONS.stop }],
    ['no request', { actionIdentifier: TOUR_ACTIONS.stop, notification: { date: 1 } }],
    ['numeric action', { actionIdentifier: 5, notification: { request: { identifier: TOUR_NOTIFICATION_ID } } }],
  ])('ignores %s quietly', (_name, payload) => {
    const t = setup();
    expect(() => t.respond(payload)).not.toThrow();
    expect(t.controls.pause).not.toHaveBeenCalled();
    expect(t.controls.end).not.toHaveBeenCalled();
    expect(t.controls.dismiss).not.toHaveBeenCalled();
  });

  it('remembers only the last 20 taps', () => {
    const t = setup();
    for (let i = 0; i < 25; i++) t.respond(tap(TOUR_ACTIONS.pause, i + 1));
    expect(t.controls.pause).toHaveBeenCalledTimes(25);
    t.respond(tap(TOUR_ACTIONS.pause, 25)); // recent: still a repeat
    expect(t.controls.pause).toHaveBeenCalledTimes(25);
  });
});

describe('readButtonTap', () => {
  it('reads command and a key that includes the date', () => {
    expect(readButtonTap(tap(TOUR_ACTIONS.stop, 42))).toEqual({ command: 'stop', key: `${TOUR_ACTIONS.stop}@42` });
  });
  it('a missing date still reads', () => {
    expect(readButtonTap({ actionIdentifier: TOUR_ACTIONS.pause, notification: { request: { identifier: TOUR_NOTIFICATION_ID } } })?.command).toBe('pause');
  });
});
