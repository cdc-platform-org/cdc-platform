import { findGarbledGeorgianWords, hasGarbledGeorgian } from '../georgianTextCheck';

describe('georgianTextCheck', () => {
  it('accepts normal Georgian, including Latin technical terms and HTML', () => {
    expect(hasGarbledGeorgian('დაუნომრავ სიას, სადაც ელემენტები აღნიშნულია წერტილებით')).toBe(false);
    expect(hasGarbledGeorgian('რა ტიპის სიას ქმნის თეგების წყვილი <ul> და <li>? HTML-ის საფუძვლები')).toBe(false);
    expect(hasGarbledGeorgian('target="_blank" ატრიბუტი')).toBe(false);
    expect(hasGarbledGeorgian('Plain English text with Ünïcödé')).toBe(false);
    expect(hasGarbledGeorgian('Обычный русский текст')).toBe(false);
  });
  it('flags a Georgian word with a Cyrillic letter inside', () => {
    expect(findGarbledGeorgianWords('დაუნომжავ სიას')).toEqual(['დაუნომжავ']);
  });
  it('flags archaic / capital Georgian letters and replacement characters', () => {
    expect(hasGarbledGeorgian('დაუნომჳავ')).toBe(true);
    expect(hasGarbledGeorgian('დაუნომᲠავ')).toBe(true);
    expect(hasGarbledGeorgian('დაუნომ�ავ')).toBe(true);
  });
});
