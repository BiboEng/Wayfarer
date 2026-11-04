import { offsetM, ORIGIN, place } from '../../__fixtures__/places';
import type { CurrentNarration, TourStatus } from '../../types';
import { notificationContentFor, sameNotificationContent, TOUR_CATEGORY_BUTTONS } from '../notification-content';

const current: CurrentNarration = { landmark: place('A', offsetM(ORIGIN, 10), { name: 'Hagia Sophia' }), side: 'ahead', text: 'x' };

describe('notificationContentFor', () => {
  it('narrating names the place, with Pause', () => {
    const content = notificationContentFor({ status: 'narrating', current });
    expect(content).toEqual({ title: 'Wayfarer tour', body: 'Now: Hagia Sophia', category: 'tour_playing' });
  });

  it('preparing with a place also names it', () => {
    expect(notificationContentFor({ status: 'preparing', current })?.body).toBe('Now: Hagia Sophia');
  });

  it('narrating or preparing without a place falls back to listening', () => {
    expect(notificationContentFor({ status: 'narrating', current: null })?.body).toBe('Listening for places nearby');
    expect(notificationContentFor({ status: 'preparing', current: null })?.category).toBe('tour_playing');
  });

  it('listening', () => {
    expect(notificationContentFor({ status: 'listening', current: null })).toEqual({
      title: 'Wayfarer tour',
      body: 'Listening for places nearby',
      category: 'tour_playing',
    });
  });

  it('paused uses tour_paused whether or not a place is current', () => {
    expect(notificationContentFor({ status: 'paused', current })).toEqual({ title: 'Wayfarer tour', body: 'Paused', category: 'tour_paused' });
    expect(notificationContentFor({ status: 'paused', current: null })?.category).toBe('tour_paused');
  });

  it.each<TourStatus>(['idle', 'ended', 'needs-permission', 'permission-denied', 'location-approximate', 'location-off', 'needs-notifications'])(
    'no notification for %s',
    (status) => expect(notificationContentFor({ status, current: null })).toBeNull(),
  );

  it('buttons: playing has Pause+Stop, paused has Resume+Stop; ids avoid ":" and "-"', () => {
    expect(TOUR_CATEGORY_BUTTONS.tour_playing.map((b) => b.title)).toEqual(['Pause', 'Stop']);
    expect(TOUR_CATEGORY_BUTTONS.tour_paused.map((b) => b.title)).toEqual(['Resume', 'Stop']);
    for (const button of Object.values(TOUR_CATEGORY_BUTTONS).flat()) expect(button.identifier).not.toMatch(/[:-]/);
  });
});

describe('sameNotificationContent', () => {
  const a = notificationContentFor({ status: 'narrating', current });
  it('equal content is the same', () => expect(sameNotificationContent(a, { ...a! })).toBe(true));
  it('null handling', () => {
    expect(sameNotificationContent(null, null)).toBe(true);
    expect(sameNotificationContent(a, null)).toBe(false);
    expect(sameNotificationContent(null, a)).toBe(false);
  });
  it('different body or category differs', () => {
    expect(sameNotificationContent(a, { ...a!, body: 'Now: Other' })).toBe(false);
    expect(sameNotificationContent(a, { ...a!, category: 'tour_paused' })).toBe(false);
  });
});
