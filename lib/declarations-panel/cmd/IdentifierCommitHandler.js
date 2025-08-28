export default function IdentifierCommitHandler(commandStack, injector) {
  // no-op constructor
}

IdentifierCommitHandler.prototype.preExecute = function (context) {
  // context expected: { reservations: [ { id, dataClassId } ], identifierService }
  const reservations =
    context && context.reservations ? context.reservations : [];
  const identifierService =
    context && context.identifierService ? context.identifierService : null;
  if (!identifierService || !reservations || !reservations.length) return;
  reservations.forEach((r) => {
    try {
      identifierService.commitReservation(r);
    } catch (e) {
      console.warn("IdentifierCommitHandler: failed to commit reservation", e);
    }
  });
};

IdentifierCommitHandler.prototype.revert = function (context) {
  const reservations =
    context && context.reservations ? context.reservations : [];
  const identifierService =
    context && context.identifierService ? context.identifierService : null;
  if (!identifierService || !reservations || !reservations.length) return;
  reservations.forEach((r) => {
    try {
      identifierService.revokeReservation(r);
    } catch (e) {
      console.warn("IdentifierCommitHandler: failed to revoke reservation", e);
    }
  });
};

IdentifierCommitHandler.$inject = ["commandStack", "injector"];
