import { getLabel } from "../../modeling/LabelUtil";
import { MODELER_PREFIX } from "../../util/constants";

import { is, getBusinessObject } from "../../util/Util";

import { useService } from "../hooks";

export function getConcreteType(element) {
  const { type: elementType } = element;

  return getRawType(elementType);
}

export const PanelHeaderProvider = (translate) => {
  if (!translate) translate = (text) => text;
  return {
    getDocumentationRef: (element) => {
      const elementTemplates = getTemplatesService();

      if (elementTemplates) {
        return getTemplateDocumentation(element, elementTemplates);
      }
    },

    getElementLabel: (element) => {
      if (is(element, `${MODELER_PREFIX}:Model`)) {
        return getBusinessObject(element).name;
      }

      return getLabel(element);
    },

    getElementIcon: (element) => {
      return null;
    },

    getTypeLabel: (element) => {
      const elementTemplates = getTemplatesService();

      if (elementTemplates) {
        const template = getTemplate(element, elementTemplates);

        if (template && template.name) {
          return translate(template.name);
        }
      }

      const concreteType = getConcreteType(element);

      return translate(concreteType);
    },
  };
};

// helpers ///////////////////////

function getRawType(type) {
  return type.split(":")[1];
}

function getTemplatesService() {
  return useService("elementTemplates", false);
}

function getTemplate(element, elementTemplates) {
  return elementTemplates.get(element);
}

function getTemplateDocumentation(element, elementTemplates) {
  const template = getTemplate(element, elementTemplates);

  return template && template.documentationRef;
}
