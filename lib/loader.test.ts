import { describe, it, expect } from 'vitest';
import { parseTemplate, expandSpecialElements } from './loader';

// ── Minimal YAML helpers ──────────────────────────────────────────────────────

const minimalYaml = (extra = '') => `
version: "1"
name: test
output:
  width: 1200
  height: 675
${extra}
element:
  type: div
  props:
    style:
      display: flex
`;

// ── parseTemplate ─────────────────────────────────────────────────────────────

describe('parseTemplate', () => {
  it('parses a minimal valid template', () => {
    const tpl = parseTemplate(minimalYaml());
    expect(tpl.name).toBe('test');
    expect(tpl.output).toEqual({ width: 1200, height: 675 });
    expect(tpl.element.type).toBe('div');
  });

  it('resolves palette-index param defaults to hex colors', () => {
    const yaml = minimalYaml(`
palette:
  - "#FF0000"
  - "#00FF00"
params:
  bg:
    default: 2
    type: color
`);
    const tpl = parseTemplate(yaml);
    expect(tpl.params.bg.default).toBe('#00FF00');
  });

  it('substitutes {{ param }} in element children via Handlebars', () => {
    const yaml = `
version: "1"
name: test
output:
  width: 1200
  height: 675
params:
  title:
    default: "Default"
element:
  type: span
  props:
    children: "{{ title }}"
`;
    const tpl = parseTemplate(yaml, { title: 'Custom' });
    expect(tpl.element.props.children).toBe('Custom');
  });

  it('uses param default when no override is provided', () => {
    const yaml = `
version: "1"
name: test
output:
  width: 1200
  height: 675
params:
  title:
    default: "Default"
element:
  type: span
  props:
    children: "{{ title }}"
`;
    const tpl = parseTemplate(yaml);
    expect(tpl.element.props.children).toBe('Default');
  });

  it('throws on invalid template structure (wrong version)', () => {
    const yaml = minimalYaml().replace('version: "1"', 'version: "99"');
    expect(() => parseTemplate(yaml)).toThrow();
  });
});

// ── expandSpecialElements — background ───────────────────────────────────────

describe('expandSpecialElements — background', () => {
  it('lifts color to parent backgroundColor and removes background element', () => {
    const node = {
      type: 'div',
      props: {
        style: { display: 'flex' },
        children: [
          { type: 'background', props: { color: '#FF0000', width: 100, height: 100 } },
          { type: 'span', props: { children: 'hello' } },
        ],
      },
    };
    const result = expandSpecialElements(node);
    expect(result.props.style.backgroundColor).toBe('#FF0000');
    expect(result.props.children).toHaveLength(1);
    expect(result.props.children[0].type).toBe('span');
  });

  it('adds absolutely-positioned img when src is provided', () => {
    const node = {
      type: 'div',
      props: {
        style: { display: 'flex' },
        children: [
          {
            type: 'background',
            props: { color: '#000', src: 'https://example.com/bg.png', width: 1200, height: 675 },
          },
        ],
      },
    };
    const result = expandSpecialElements(node);
    expect(result.props.children).toHaveLength(1);
    const img = result.props.children[0];
    expect(img.type).toBe('img');
    expect(img.props.src).toBe('https://example.com/bg.png');
    expect(img.props.style.position).toBe('absolute');
  });
});

// ── expandSpecialElements — lines ────────────────────────────────────────────

describe('expandSpecialElements — lines', () => {
  it('splits text on newlines into a flex column of divs', () => {
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: 'Line 1\nLine 2\nLine 3' },
    };
    const result = expandSpecialElements(node);
    expect(result.type).toBe('div');
    expect(result.props.style.flexDirection).toBe('column');
    expect(result.props.children).toHaveLength(3);
  });

  it('converts inner blank lines to spacer divs using fontSize as height', () => {
    const node = {
      type: 'lines',
      props: { style: { fontSize: 32 }, children: 'Para A\n\nPara B' },
    };
    const result = expandSpecialElements(node);
    // 3 items: 'Para A', spacer, 'Para B'
    expect(result.props.children).toHaveLength(3);
    const spacer = result.props.children[1];
    expect(spacer.props.style.height).toBe(32);
  });

  it('trims leading and trailing blank lines', () => {
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: '\nActual line\n' },
    };
    const result = expandSpecialElements(node);
    expect(result.props.children).toHaveLength(1);
  });
});

// ── expandSpecialElements — coerceStyle ──────────────────────────────────────

describe('expandSpecialElements — coerceStyle', () => {
  it('converts string opacity to a number', () => {
    const node = {
      type: 'div',
      props: { style: { opacity: '0.75', display: 'flex' } },
    };
    const result = expandSpecialElements(node);
    expect(result.props.style.opacity).toBe(0.75);
  });

  it('converts string lineHeight to a number', () => {
    const node = {
      type: 'div',
      props: { style: { lineHeight: '1.5', display: 'flex' } },
    };
    const result = expandSpecialElements(node);
    expect(result.props.style.lineHeight).toBe(1.5);
  });

  it('leaves non-numeric CSS props (color, fontFamily) untouched', () => {
    const node = {
      type: 'div',
      props: { style: { color: '#fff', fontFamily: 'Caveat', display: 'flex' } },
    };
    const result = expandSpecialElements(node);
    expect(result.props.style.color).toBe('#fff');
    expect(result.props.style.fontFamily).toBe('Caveat');
  });
});

// ── expandSpecialElements — inline markup ────────────────────────────────────

describe('expandSpecialElements — inline markup', () => {
  it('[SPAN FG=N] applies palette color to the matching span', () => {
    const palette = ['#FF0000', '#00FF00'];
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: '[SPAN FG=1]red text[/]' },
    };
    const result = expandSpecialElements(node, palette);
    // result → column div → line div → inline element div → span
    const lineDiv = result.props.children[0];
    const inlineEl = lineDiv.props.children[0];
    const span = inlineEl.props.children[0];
    expect(span.props.style.color).toBe('#FF0000');
    expect(span.props.children).toBe('red text');
  });

  it('[ALIGN=center] sets justifyContent: center on the line wrapper', () => {
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: '[ALIGN=center]Centered' },
    };
    const result = expandSpecialElements(node);
    const lineDiv = result.props.children[0];
    expect(lineDiv.props.style.justifyContent).toBe('center');
  });

  it('[SPAN FG=N] behaves like [FG=N] (explicit span alias)', () => {
    const palette = ['#FF0000', '#00FF00'];
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: '[SPAN FG=1]red text[/]' },
    };
    const result = expandSpecialElements(node, palette);
    const lineDiv = result.props.children[0];
    const inlineEl = lineDiv.props.children[0];
    const span = inlineEl.props.children[0];
    expect(span.props.style.color).toBe('#FF0000');
    expect(span.props.children).toBe('red text');
  });

  it('[DIV BG=N] creates a full-width div inside the line wrapper, with flex: 1 and backgroundColor', () => {
    const palette = ['#0D1B2A', '#FFFFFF'];
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: '[DIV BG=1]Full width band[/]' },
    };
    const result = expandSpecialElements(node, palette);
    const lineDiv = result.props.children[0]; // line wrapper (flex row)
    const divEl = lineDiv.props.children[0];  // the [DIV] block
    expect(divEl.type).toBe('div');
    expect(divEl.props.style.flex).toBe(1);
    expect(divEl.props.style.backgroundColor).toBe('#0D1B2A');
  });

  it('[DIV FG=N] applies color to the inner span, not the outer div', () => {
    const palette = ['#0D1B2A', '#FFFFFF'];
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: '[DIV FG=2]White text[/]' },
    };
    const result = expandSpecialElements(node, palette);
    const lineDiv = result.props.children[0]; // line wrapper
    const divEl = lineDiv.props.children[0];  // the [DIV] block
    expect(divEl.type).toBe('div');
    expect(divEl.props.style.color).toBeUndefined();
    const innerSpan = divEl.props.children[0];
    expect(innerSpan.props.style.color).toBe('#FFFFFF');
  });

  it('[DIV ALIGN=right] sets justifyContent: flex-end on the block div', () => {
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: '[DIV ALIGN=right]Author[/]' },
    };
    const result = expandSpecialElements(node);
    const lineDiv = result.props.children[0]; // line wrapper
    const divEl = lineDiv.props.children[0];  // the [DIV] block
    expect(divEl.type).toBe('div');
    expect(divEl.props.style.justifyContent).toBe('flex-end');
  });

  it('[DIV] mixed with plain text wraps both in a flex row, DIV gets flex: 1', () => {
    const palette = ['#0D1B2A', '#FFFFFF'];
    const node = {
      type: 'lines',
      props: { style: { fontSize: 28 }, children: 'Label: [DIV BG=1]value[/]' },
    };
    const result = expandSpecialElements(node, palette);
    const lineDiv = result.props.children[0]; // line wrapper (flex row)
    const outerEl = lineDiv.props.children[0]; // outer flex container for mixed content
    expect(outerEl.type).toBe('div');
    expect(outerEl.props.style.display).toBe('flex');
    const children = outerEl.props.children;
    expect(children[0].type).toBe('span');
    expect(children[0].props.children).toBe('Label: ');
    expect(children[1].type).toBe('div');
    expect(children[1].props.style.flex).toBe(1); // fills remaining horizontal space
  });
});
