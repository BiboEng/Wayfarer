import type { PlayableNarration } from '@/audio/types';

import { createFakePlayer } from '../__fixtures__/fake-player';
import { createPlayerLink } from '../player-link';

const story = (id: string): PlayableNarration => ({ id, title: id, text: `Text ${id}`, audio: null });

function setup() {
  const fake = createFakePlayer();
  const link = createPlayerLink(fake.player);
  const ended = jest.fn();
  const changed = jest.fn();
  link.connect(ended, changed);
  return { ...fake, link, ended, changed };
}

describe('createPlayerLink', () => {
  it('plays the story through the player', () => {
    const { link, played } = setup();
    link.play(story('tour:1:a'));
    expect(played.map((n) => n.id)).toEqual(['tour:1:a']);
  });

  it('does not report the start of its own story as an end', () => {
    const { link, ended, changed } = setup();
    link.play(story('tour:1:a'));
    expect(ended).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalled();
  });

  it('reports the end once when the story ended', () => {
    const { link, ended, finish, started } = setup();
    link.play(story('tour:1:a'));
    started();
    finish();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith('tour:1:a', false);
  });

  it('counts a failed playback as done, and says it failed', () => {
    const { link, ended, fail } = setup();
    link.play(story('tour:1:a'));
    fail();
    expect(ended).toHaveBeenCalledWith('tour:1:a', true);
  });

  it('reports the end only once, however many updates follow', () => {
    const { link, ended, finish, player } = setup();
    link.play(story('tour:1:a'));
    finish();
    player.stop();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('counts a story replaced by someone else as done', () => {
    const { link, ended, playOther } = setup();
    link.play(story('tour:1:a'));
    playOther('explore:9');
    expect(ended).toHaveBeenCalledWith('tour:1:a', false);
  });

  it('reports the end of the new story after playing a second one', () => {
    const { link, ended, finish } = setup();
    link.play(story('tour:1:a'));
    finish();
    link.play(story('tour:2:b'));
    expect(ended).toHaveBeenCalledTimes(1);
    finish();
    expect(ended).toHaveBeenLastCalledWith('tour:2:b', false);
  });

  it('ignores narrations that are not the tour\'s', () => {
    const { ended, playOther, finish, player } = setup();
    playOther('explore:1');
    finish();
    player.stop();
    expect(ended).not.toHaveBeenCalled();
  });

  it('stop stops the tour\'s story without reporting an end', () => {
    const { link, ended, player } = setup();
    link.play(story('tour:1:a'));
    link.stop();
    expect(player.getState().status).toBe('idle');
    expect(ended).not.toHaveBeenCalled();
  });

  it('stop never touches someone else\'s sound', () => {
    const { link, player, playOther } = setup();
    link.play(story('tour:1:a'));
    playOther('explore:1');
    link.stop();
    expect(player.getState().narrationId).toBe('explore:1');
    expect(player.getState().status).toBe('loading');
  });

  it('pause and resume affect only the tour\'s story', () => {
    const { link, player, started, playOther } = setup();
    link.play(story('tour:1:a'));
    started();
    link.pause();
    expect(player.getState().status).toBe('paused');
    expect(link.isPaused()).toBe(true);
    link.resume();
    expect(player.getState().status).toBe('playing');
    expect(link.isPaused()).toBe(false);

    playOther('explore:1');
    started();
    link.pause();
    expect(player.getState().status).toBe('playing');
    expect(link.isPaused()).toBe(false);
  });

  it('isPaused is true when the system paused the story', () => {
    const { link, started, systemPause } = setup();
    link.play(story('tour:1:a'));
    started();
    systemPause();
    expect(link.isPaused()).toBe(true);
  });

  it('after a system pause the tour can resume its story', () => {
    const { link, player, started, systemPause } = setup();
    link.play(story('tour:1:a'));
    started();
    systemPause();
    link.resume();
    expect(player.getState().status).toBe('playing');
  });

  it('disconnect stops all reports', () => {
    const { link, ended, changed, finish, listenerCount } = setup();
    link.play(story('tour:1:a'));
    link.disconnect();
    changed.mockClear();
    finish();
    expect(ended).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(listenerCount()).toBe(0);
  });

  it('connecting again replaces the previous listener', () => {
    const { link, listenerCount, finish } = setup();
    const second = jest.fn();
    link.connect(second, jest.fn());
    expect(listenerCount()).toBe(1);
    link.play(story('tour:1:a'));
    finish();
    expect(second).toHaveBeenCalledWith('tour:1:a', false);
  });
});
