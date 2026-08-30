export class EditHistory {
  constructor(max = 100) {
    this.max = max;
    this.undoStack = [];
    this.redoStack = [];
  }
  push(snapshot) {
    const s = JSON.stringify(snapshot);
    if (this.undoStack.length && this.undoStack[this.undoStack.length - 1] === s) return;
    this.undoStack.push(s);
    if (this.undoStack.length > this.max) this.undoStack.shift();
    this.redoStack = [];
  }
  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  undo(current) {
    if (!this.canUndo()) return null;
    const cur = JSON.stringify(current);
    this.redoStack.push(cur);
    const prevStr = this.undoStack.pop();
    try { return JSON.parse(prevStr); } catch { return null; }
  }
  redo(current) {
    if (!this.canRedo()) return null;
    const cur = JSON.stringify(current);
    this.undoStack.push(cur);
    const nxtStr = this.redoStack.pop();
    try { return JSON.parse(nxtStr); } catch { return null; }
  }
  clear() { this.undoStack = []; this.redoStack = []; }
}
