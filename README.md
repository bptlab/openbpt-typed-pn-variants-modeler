# openbpt-typed-pn-variants-modeler

A modeler for various typed Petri net variants presented in literature. Currently supported types are:

- t-PNID (typed Petri nets with Identifiers)
- OCPN (Object-centric Petri nets)
- OPID (Object-centric Petri nets with Identifiers)

The modeler is based on the [openbpt-modeler-petri-net](https://github.com/bptlab/openbpt-modeler-petri-net) modeler, which makes use of the wonderful [diagram-js](https://github.com/bpmn-io/diagram-js) library and took inspiration from [bpmn-js](https://github.com/bpmn-io/bpmn-js), [object-diagram-js](https://github.com/timKraeuter/object-diagram-js) and [fcm-js](https://github.com/bptlab/fCM-design-support).

## Development Setup

1. Clone this repository: ``git clone git@github.com:bptlab/openbpt-typed-pn-variants-modeler.git``
2. Navigate into the created directory
3. Run ``npm install``
4. Run ``npm link``
5. Clone the [development repository](https://github.com/bptlab/openbpt-modeler-dev/tree/openbpt-typed-pn-variants-modeler): ``git clone git@github.com:bptlab/openbpt-modeler-dev.git``
6. Navigate into the created directory
7. Checkout the `openbpt-typed-pn-variants-modeler` branch
8. Run ``npm install``
9. Run ``npm link openbpt-typed-pn-variants-modeler``

To start the modeler, run ``npm run dev`` in the development repo's directory.

## Defining the Metamodel

To define the model structure, we build on [moddle](https://github.com/bpmn-io/moddle), which uses a schema defined as a JSON file to create a metamodel that can be used to instantiate model elements while knowing their attributes and relations and provides a structure for importing and exporting XML files.
The followning class diagram shows the currently implemented metamodel used in the modeler. It can be generally divided into two sides:

- The _semantic_ elements are the classes on the left, everything inheriting from `Schema`. They define the different model elements and their attributes/relations.
- The _syntactic_ elements are the classes on the right, everything inheriting from `DiagramElement` as well as `Diagram` and `Plane`. These elements are visual representatoions of the model elements, including positional information and associated labels.

![OPID_Class_Diagram](https://github.com/user-attachments/assets/2b4c63d3-8a09-49a7-8e7b-635a30bd07c8)

In most cases, it should not be necessary to modify the metamodel of the _syntactic_ elements. For the _semantic_ elements, the classes inheriting from `Node` and `BinaryConnection` (marked in red) must be defined for the respective modeling language in [modelSchema.js](https://github.com/bptlab/openbpt-modeler-template/blob/main/lib/moddle/resources/modelSchema.js). Further information can be found in the [documentation](https://github.com/bpmn-io/moddle/blob/main/docs/descriptor.md). Setting `isAttr` for a property will include it as an attribute in the XML, otherwise it is stored as a separate child-tag.
