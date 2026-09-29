/**
 * Turns Markdown container directives into accessible callout boxes.
 *
 *   :::warning
 *   At least one author must register.
 *   :::
 *
 * becomes
 *
 *   <aside class="callout callout-warning">
 *     <b class="callout-title">Important</b>
 *     <p>At least one author must register.</p>
 *   </aside>
 *
 * A custom label is supported: `:::note[Visa applicants]`.
 *
 * Why a directive rather than raw HTML in the Markdown: the person editing a
 * CFP should not have to write or maintain HTML, and the styling stays in one
 * stylesheet instead of being copied into every page.
 */
import { visit } from 'unist-util-visit';

/** Directive name -> [css modifier, default heading]. */
const KINDS = {
  note: ['', 'Note'],
  warning: ['callout-warning', 'Important'],
  tbd: ['callout-tbd', 'Not yet confirmed'],
};

export function remarkCallouts() {
  return (tree, file) => {
    visit(tree, (node) => {
      if (node.type !== 'containerDirective') return;
      const kind = KINDS[node.name];
      if (!kind) {
        file.message(
          `Unknown callout ":::${node.name}". Use one of: ${Object.keys(KINDS).join(', ')}.`,
          node,
        );
        return;
      }
      const [modifier, defaultTitle] = kind;

      // `:::note[Custom title]` parses as a directiveLabel paragraph child.
      let title = defaultTitle;
      const first = node.children[0];
      if (first?.data?.directiveLabel && first.children?.[0]?.value) {
        title = first.children[0].value;
        node.children.shift();
      }

      node.data = {
        ...node.data,
        hName: 'aside',
        hProperties: { class: ['callout', modifier].filter(Boolean).join(' ') },
      };
      node.children.unshift({
        type: 'paragraph',
        data: { hName: 'b', hProperties: { class: 'callout-title' } },
        children: [{ type: 'text', value: title }],
      });
    });
  };
}

export default remarkCallouts;
