import {
  displayGloss,
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

  it('skips hollow 것 endings and prefers a real verb lemma', () => {
    expect(extractKoreanHeadword('무언가를 제공하거나 공급하는 것.')).toBe('공급하다');
    expect(displayGloss({
      definition: 'To make something needed available.',
      short_definition: 'To provide or furnish something.',
      localized_definition: '필요하거나 원하는 것을 누군가에게 제공하거나 갖추어 주는 것.',
      localized_short_definition: '무언가를 제공하거나 공급하는 것.',
    })).toBe('공급하다');
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

describe('displayGloss / splitMeanings', () => {
  it('returns a simple headword only for display', () => {
    const fields = {
      definition: 'To cover something completely so that it cannot be seen.',
      short_definition: 'To hide or conceal something by covering it.',
      localized_definition: '무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.',
      localized_short_definition: '무엇을 덮어 감추다.',
    };
    expect(displayGloss(fields)).toBe('감추다');
    expect(splitMeanings(fields)).toEqual({ simple: '감추다', full: null });
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

  it('prefers personal_note over catalog gloss', () => {
    expect(
      displayGloss({
        personal_note: '내 뜻',
        definition: 'to store energy',
        short_definition: 'charge',
        localized_definition: '충전하다',
        localized_short_definition: '충전하다',
      }),
    ).toBe('내 뜻');
  });
});
