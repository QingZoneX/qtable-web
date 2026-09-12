export type LayoutInstance = { add: (node: unknown) => void };
export type LayoutComponent = new (
  attribute: Record<string, unknown>,
) => LayoutInstance;
export type LayoutChild = unknown;
export type LayoutProps = {
  attribute?: Record<string, unknown>;
  children?: LayoutChild;
};

export type CustomLayoutLike = {
  Group: LayoutComponent;
  Text: LayoutComponent;
  Image: LayoutComponent;
  Tag?: LayoutComponent;
};

export const jsx = (
  type: LayoutComponent,
  config: LayoutProps | null,
  ...args: LayoutChild[]
) => {
  const props = config ?? {};
  const attribute = props.attribute ?? {};

  const instance = new type(attribute);

  const addNode = (node: LayoutChild) => {
    if (Array.isArray(node)) {
      node.forEach(addNode);
    } else if (node) {
      instance.add(node);
    }
  };

  // Handle children from props (Automatic Runtime or manually passed)
  if (props.children !== undefined) {
    addNode(props.children);
  }

  // Handle children from arguments (Classic Runtime)
  if (args && args.length > 0) {
    addNode(args);
  }

  return instance;
};

export const jsxs = jsx;

export const Fragment = () => null;

/**
 * Create a jsx function bound to a specific CustomLayout-like provider.
 * This is needed because @visactor/vtable and @visactor/vtable-gantt
 * may bundle their own copies of VRender, causing instances created by
 * one package to be invisible to the other.
 */
export const createJsx = (customLayout: CustomLayoutLike) => {
  void customLayout;
  return (type: LayoutComponent, config: LayoutProps | null, ...args: LayoutChild[]) =>
    jsx(type, config, ...args);
};
