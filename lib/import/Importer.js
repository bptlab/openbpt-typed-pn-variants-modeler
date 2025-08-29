import CustomTreeWalker from './CustomTreeWalker';
import { Events } from '../common/EventBusEvents';

export function importDiagram(modeler, definitions, rootDiagram) {

    let importer;
    let eventBus;
    let translate;

    let error;
    const warnings = [];

    /**
     * Walk the diagram semantically, importing (=drawing)
     * all elements you encounter.
     */
    function render(definitions, rootDiagram) {
        const visitor = {
            root: function (element) {
                return importer.add(element);
            },
            element: function (element, parentShape) {
                return importer.add(element, parentShape);
            },
            error: function (message, context) {
                warnings.push({message: message, context: context});
            }
        };

        const walker = new CustomTreeWalker(visitor, translate);

        // traverse xml document model,
        // starting at definitions
        walker.handleDefinitions(definitions, rootDiagram);
    }

    return new Promise(function (resolve, reject) {
        try {
            importer = modeler.get('customImporter');
            eventBus = modeler.get('eventBus');
            translate = modeler.get('translate');

            eventBus.fire(Events.IMPORT_RENDER_START, {definitions: definitions});

            render(definitions, rootDiagram);

            eventBus.fire(Events.IMPORT_RENDER_COMPLETE, {
                error: error,
                warnings: warnings
            });

            return resolve({warnings: warnings});
        } catch (e) {
            return reject(e);
        }
    });
}
