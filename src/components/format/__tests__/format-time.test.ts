import { formatTime } from '../format-time';

describe('formatTime', () => {
  it('shows the local hour and minute of the time', () => {
    const text = formatTime(new Date(2026, 5, 10, 14, 35, 59).getTime());
    // 12-hour ("2:35 PM") or 24-hour ("14:35") depending on the phone's locale.
    expect(text.replace(/\s/g, ' ')).toMatch(/^(2[:.]35 ?p\.?m\.?|14[:.]35)/i);
  });

  it('pads the minutes', () => {
    expect(formatTime(new Date(2026, 5, 10, 9, 5).getTime())).toMatch(/[:.]05/);
  });

  it('does not show seconds', () => {
    expect(formatTime(new Date(2026, 5, 10, 14, 35, 59).getTime())).not.toMatch(/59/);
  });
});
