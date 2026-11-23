// 子应用的 Tailwind 类名都带子应用前缀（Tailwind 4 的 prefix，写在各子应用的 src/styles.css）：各应用单独构建的
// 工具类会先后进同一个页面，同名的类后来的覆盖先来的，会打乱变体的先后（主应用的 hidden md:block 会被盖住）。
// 只查“类名取值”的字符串：className 与 *ClassName 属性、cn()/clsx() 的参数、名为 *class* 的变量与对象属性，
// 其中条件表达式的两个分支、与或运算的取值一侧照查；比较、别的函数调用等位置不算类名。可自动补前缀。

const CLASS_ATTRIBUTE = /^(className|[A-Za-z]+ClassName)$/;
const CLASS_NAME = /(^|[a-z])(class|classes|className|classNames)$/i;
const CLASS_FUNCTIONS = new Set(['cn', 'clsx', 'twMerge']);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: { description: '子应用的 Tailwind 类名要带子应用前缀' },
    schema: [
      {
        type: 'object',
        properties: { prefix: { type: 'string', pattern: '^[a-z]+$' } },
        required: ['prefix'],
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        '子应用的 Tailwind 类名要带前缀 {{prefix}}:（如 {{prefix}}:flex、{{prefix}}:md:hidden）：{{classes}}',
    },
  },
  create(context) {
    const { prefix } = context.options[0];
    const marker = `${prefix}:`;
    const missing = (text) =>
      text.split(/\s+/).filter((token) => token && !token.startsWith(marker));
    const withPrefix = (text) =>
      text.replace(/\S+/g, (token) =>
        token.startsWith(marker) ? token : marker + token,
      );
    const report = (node, classes, fix) =>
      context.report({
        node,
        messageId: 'missing',
        data: { prefix, classes: classes.join(' ') },
        fix,
      });

    /** 一个类名取值表达式。cn() 等调用由 CallExpression 自己查，这里不重复。 */
    const check = (node) => {
      if (!node) return;
      switch (node.type) {
        case 'Literal': {
          if (typeof node.value !== 'string') return;
          const classes = missing(node.value);
          if (classes.length)
            report(node, classes, (fixer) =>
              fixer.replaceText(
                node,
                node.raw[0] + withPrefix(node.raw.slice(1, -1)) + node.raw[0],
              ),
            );
          return;
        }
        case 'TemplateLiteral':
          // 插值两旁的半截类名（如 bg-${color}）没法补，只报出来。
          for (const quasi of node.quasis) {
            const classes = missing(quasi.value.raw);
            if (classes.length) report(quasi, classes);
          }
          return;
        case 'JSXExpressionContainer':
          return check(node.expression);
        case 'ConditionalExpression':
          check(node.consequent);
          check(node.alternate);
          return;
        case 'LogicalExpression':
          if (node.operator !== '&&') check(node.left);
          check(node.right);
          return;
        case 'ArrayExpression':
          node.elements.forEach(check);
          return;
        default:
      }
    };

    return {
      JSXAttribute(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          CLASS_ATTRIBUTE.test(node.name.name)
        )
          check(node.value);
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          CLASS_FUNCTIONS.has(node.callee.name)
        )
          node.arguments.forEach(check);
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && CLASS_NAME.test(node.id.name))
          check(node.init);
      },
      Property(node) {
        if (
          !node.computed &&
          node.key.type === 'Identifier' &&
          CLASS_NAME.test(node.key.name)
        )
          check(node.value);
      },
    };
  },
};

const plugin = { rules: { 'tailwind-prefix': rule } };

/**
 * 某个子应用源码里的 Tailwind 类名都要带它的前缀（与它 src/styles.css 里的 prefix(...) 一致）。
 *
 * @param {string} appName apps 下的子应用目录名
 * @param {string} prefix Tailwind 前缀（小写字母）
 * @returns {import('eslint').Linter.Config}
 */
export function tailwindPrefix(appName, prefix) {
  return {
    name: `admin-web/tailwind-prefix/${appName}`,
    files: [`apps/${appName}/src/**/*.{ts,tsx,js,jsx}`],
    plugins: { 'admin-web': plugin },
    rules: { 'admin-web/tailwind-prefix': ['error', { prefix }] },
  };
}

/**
 * 从子应用的样式入口读出 Tailwind 前缀（@import 'tailwindcss/theme.css' ... prefix(<前缀>)）；没有前缀时为 undefined。
 *
 * @param {string} css 样式入口的内容
 * @returns {string | undefined}
 */
export function readTailwindPrefix(css) {
  return /\bprefix\(([a-z]+)\)/.exec(css)?.[1];
}
