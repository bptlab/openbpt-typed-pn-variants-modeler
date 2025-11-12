import { TOGGLE_MODE_EVENT } from "../EventHelper";

const HIGH_PRIORITY = 10001;

export default function DisableModeling(
  eventBus,
  dragging,
  directEditing,
  editorActions,
  modeling,
  palette,
) {
  let modelingDisabled = false;

  eventBus.on(TOGGLE_MODE_EVENT, HIGH_PRIORITY, (event) => {
    modelingDisabled = event.active;

    if (modelingDisabled) {
      directEditing.cancel();
      dragging.cancel();
    }

    palette._update();
  });

  function intercept(obj, fnName, cb) {
    if (!obj) return;
    const fn = obj[fnName];
    if (typeof fn !== "function") return;

    obj[fnName] = function () {
      return cb.call(this, fn, arguments);
    };
  }

  function ignoreIfModelingDisabled(obj, fnName) {
    intercept(obj, fnName, function (fn, args) {
      if (modelingDisabled) {
        return;
      }

      return fn.apply(this, args);
    });
  }

  ignoreIfModelingDisabled(dragging, "init");
  ignoreIfModelingDisabled(directEditing, "activate");

  ignoreIfModelingDisabled(modeling, "moveShape");
  ignoreIfModelingDisabled(modeling, "updateAttachment");
  ignoreIfModelingDisabled(modeling, "moveElements");
  ignoreIfModelingDisabled(modeling, "moveConnection");
  ignoreIfModelingDisabled(modeling, "layoutConnection");
  ignoreIfModelingDisabled(modeling, "createConnection");
  ignoreIfModelingDisabled(modeling, "createShape");
  ignoreIfModelingDisabled(modeling, "createLabel");
  ignoreIfModelingDisabled(modeling, "appendShape");
  ignoreIfModelingDisabled(modeling, "removeElements");
  ignoreIfModelingDisabled(modeling, "distributeElements");
  ignoreIfModelingDisabled(modeling, "removeShape");
  ignoreIfModelingDisabled(modeling, "removeConnection");
  ignoreIfModelingDisabled(modeling, "replaceShape");
  ignoreIfModelingDisabled(modeling, "pasteElements");
  ignoreIfModelingDisabled(modeling, "alignElements");
  ignoreIfModelingDisabled(modeling, "resizeShape");
  ignoreIfModelingDisabled(modeling, "createSpace");
  ignoreIfModelingDisabled(modeling, "updateWaypoints");
  ignoreIfModelingDisabled(modeling, "reconnectStart");
  ignoreIfModelingDisabled(modeling, "reconnectEnd");

  intercept(editorActions, "trigger", function (fn, args) {
    const action = args[0];

    // allow list actions permitted,
    // everything else is likely incompatible with
    // token simulation mode
    if (
      modelingDisabled &&
      !isAnyAction(
        [
          "toggleTokenSimulation",
          "toggleTokenSimulationLog",
          "togglePauseTokenSimulation",
          "resetTokenSimulation",
          "stepZoom",
          "zoom",
        ],
        action,
      )
    ) {
      return;
    }

    return fn.apply(this, args);
  });
}

DisableModeling.$inject = [
  "eventBus",
  "dragging",
  "directEditing",
  "editorActions",
  "modeling",
  "palette",
];

// helpers //////////

function isAnyAction(actions, action) {
  return actions.includes(action);
}
