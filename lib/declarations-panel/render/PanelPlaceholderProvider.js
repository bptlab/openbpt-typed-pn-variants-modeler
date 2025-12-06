export const PanelPlaceholderProvider = (translate) => {
  if (!translate) translate = (text) => text;
  return {
    getEmpty: () => {
      return {
        text: translate("Select an element to edit its properties."),
      };
    },

    getMultiple: () => {
      return {
        text: translate(
          "Multiple elements are selected. Select a single element to edit its properties.",
        ),
      };
    },
  };
};
