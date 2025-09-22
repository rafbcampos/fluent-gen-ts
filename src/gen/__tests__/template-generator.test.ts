import { describe, test, expect } from 'vitest';
import { getCommonFileTemplate, getSingleFileUtilitiesTemplate } from '../template-generator.js';

describe('template-generator', () => {
  test('creates common template with proper header and utilities content', () => {
    const result = getCommonFileTemplate();

    expect(result).toMatchSnapshot();
  });

  test('removes export keywords from utilities content', () => {
    const result = getSingleFileUtilitiesTemplate();

    expect(result).toMatchSnapshot();
  });
});
