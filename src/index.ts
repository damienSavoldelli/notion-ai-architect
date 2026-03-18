export const bootstrap = (): string => "Notion AI Architect backend is ready.";

export const maybePrintBootstrap = (
  isMain: boolean,
  log: (message: string) => void = console.log,
): void => {
  if (isMain) {
    log(bootstrap());
  }
};

maybePrintBootstrap(import.meta.main);
