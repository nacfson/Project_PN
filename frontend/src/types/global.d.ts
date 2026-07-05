declare const chrome: {
  runtime?: {
    sendMessage?: (extensionId: string, message: unknown) => void;
  };
};
