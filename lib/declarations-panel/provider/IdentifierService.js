export default function IdentifierService(elementRegistry) {
  // injector-provided registry to inspect current tokens on the diagram
  this.elementRegistry = elementRegistry;

  // Internal list of identifiers
  this.objectIdentifiers = [];

  this.getIdentifiers = () => {
    return Array.from(this.objectIdentifiers);
  };

  this.setIdentifiers = (ids) => {
    this.objectIdentifiers = Array.from(ids || []);
  };

  this.addIdentifier = (id) => {
    if (!this.objectIdentifiers.includes(id)) {
      this.objectIdentifiers.push(id);
    }
  };

  // gather existing identifiers from internal list and from currently present tokens
  this._collectExistingIds = () => {
    const ids = new Set(this.objectIdentifiers || []);

    if (
      this.elementRegistry &&
      typeof this.elementRegistry.forEach === "function"
    ) {
      try {
        this.elementRegistry.forEach((element) => {
          if (element.type === "ptn:Place") {
            const marking = element.businessObject?.marking || [];
            marking.forEach((token) => {
              (token.values || []).forEach((v) => {
                if (v && v.value !== undefined && v.value !== null) {
                  ids.add(String(v.value));
                }
              });
            });
          }
        });
      } catch (e) {
        // defensively ignore any iteration errors
        console.warn(
          "IdentifierService: failed to collect ids from elementRegistry",
          e
        );
      }
    }

    return ids;
  };

  this.generateUniqueId = (dataClass) => {
    const dataClassName = dataClass.name;

    const existingIds = Array.from(this._collectExistingIds()).filter((id) =>
      new RegExp(`^${dataClassName}_\\d+$`).test(id)
    );

    let maxId = 0;

    existingIds.forEach((id) => {
      const match = id.match(new RegExp(`^${dataClassName}_(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });

    // ensure we don't return an id that somehow already exists (race or external change)
    let candidate = null;
    let attempt = 0;
    do {
      candidate = `${dataClassName}_${maxId + 1 + attempt}`;
      attempt++;
    } while (this._collectExistingIds().has(candidate));

    this.addIdentifier(candidate);
    return candidate;
  };
}

IdentifierService.$inject = ["elementRegistry"];
