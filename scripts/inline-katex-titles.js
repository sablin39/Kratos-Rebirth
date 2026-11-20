'use strict';

const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');
const { escapeHTML } = require('hexo-util');

const katexPath = require.resolve('hexo-filter-katex/package.json');
const katex = createRequire(join(dirname(katexPath), 'index.js'))('katex');

function inlineMathTitle(title) {
  if (typeof title !== 'string' || !title.includes('$')) return escapeHTML(title);

  let output = '';
  let plainTextStart = 0;
  let position = 0;

  while (position < title.length) {
    if (title[position] === '\\') {
      position += 2;
      continue;
    }
    if (title[position] !== '$' || title[position + 1] === '$') {
      position++;
      continue;
    }

    const formulaStart = position + 1;
    let formulaEnd = formulaStart;
    let closingDelimiter = -1;

    while (formulaEnd < title.length && title[formulaEnd] !== '\n') {
      if (title[formulaEnd] === '\\') {
        formulaEnd += 2;
        continue;
      }
      if (title[formulaEnd] === '$') {
        closingDelimiter = formulaEnd;
        break;
      }
      formulaEnd++;
    }

    if (closingDelimiter === -1) {
      position++;
      continue;
    }

    const formula = title.slice(formulaStart, formulaEnd);
    let renderedFormula;
    try {
      renderedFormula = katex.renderToString(formula, {
        displayMode: false,
        throwOnError: false,
        ...hexo.config.katex?.render_options
      });
    } catch {
      position = closingDelimiter + 1;
      continue;
    }

    output += escapeHTML(title.slice(plainTextStart, position)) + renderedFormula;
    position = closingDelimiter + 1;
    plainTextStart = position;
  }

  return output + escapeHTML(title.slice(plainTextStart));
}

hexo.extend.helper.register('inline_math_title', inlineMathTitle);
