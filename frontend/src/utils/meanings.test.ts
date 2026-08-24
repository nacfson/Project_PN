import {
  extractKoreanHeadword,
  isSimpleGloss,
  preferSimpleGloss,
  splitMeanings,
} from './meanings';

describe('isSimpleGloss', () => {
  it('accepts one-word Korean headwords and comma lists', () => {
    expect(isSimpleGloss('덮다')).toBe(true);
    expect(isSimpleGloss('사과')).toBe(true);
    expect(isSimpleGloss('노출하다')).toBe(true);
    expect(isSimpleGloss('떠나다, 버리다')).toBe(true);
  });

  it('rejects dictionary paraphrases', () => {
    expect(isSimpleGloss('무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.')).toBe(false);
    expect(isSimpleGloss('시체를 땅에 묻다')).toBe(false);
    expect(isSimpleGloss('To hide or conceal something by covering it')).toBe(false);
  });
});

describe('extractKoreanHeadword', () => {
  it('takes the final predicate from a dictionary gloss', () => {
    expect(extractKoreanHeadword('흙이나 눈 등으로 ~을 덮다.')).toBe('덮다');
    expect(extractKoreanHeadword('무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.')).toBe('감추다');
    expect(extractKoreanHeadword('시체를 땅에 묻다.')).toBe('묻다');
    expect(extractKoreanHeadword('어떤 일에 몰두하다')).toBe('몰두하다');
  });
});

describe('preferSimpleGloss', () => {
  it('keeps an already-simple short', () => {
    expect(preferSimpleGloss('덮다', '흙이나 눈 등으로 ~을 덮다')).toBe('덮다');
  });

  it('simplifies a verbose short using the last Korean headword', () => {
    expect(preferSimpleGloss('무엇을 덮어 감추다', '무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.')).toBe(
      '감추다',
    );
  });

  it('strips English infinitive paraphrases to the verb', () => {
    expect(
      preferSimpleGloss(
        'To hide or conceal something by covering it with earth, snow, or other material.',
        'To cover something completely so that it cannot be seen.',
      ),
    ).toBe('hide');
  });
});

describe('splitMeanings', () => {
  it('returns simple headword plus current full meaning', () => {
    expect(
      splitMeanings({
        definition: 'To cover something completely so that it cannot be seen.',
        short_definition: 'To hide or conceal something by covering it.',
        localized_definition: '무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.',
        localized_short_definition: '무엇을 덮어 감추다.',
      }),
    ).toEqual({ simple: '감추다', full: '무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.' });
  });

  it('does not duplicate when simple and full already match', () => {
    expect(
      splitMeanings({
        definition: 'to store energy',
        short_definition: 'charge',
        localized_definition: '충전하다',
        localized_short_definition: '충전하다',
      }),
    ).toEqual({ simple: '충전하다', full: null });
  });

  it('omits localized meanings when they copy the English definition', () => {
    expect(
      splitMeanings({
        definition: 'same meaning',
        short_definition: null,
        localized_definition: 'same meaning',
        localized_short_definition: null,
      }),
    ).toEqual({ simple: null, full: null });
  });
});
