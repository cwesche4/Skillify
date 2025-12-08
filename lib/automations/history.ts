// lib/automations/history.ts
export class HistoryStack<T> {
  private stack: T[] = []
  private pointer = -1

  push(state: T) {
    // remove forward history
    this.stack = this.stack.slice(0, this.pointer + 1)

    // push new
    this.stack.push(JSON.parse(JSON.stringify(state)))
    this.pointer = this.stack.length - 1
  }

  undo(): T | null {
    if (this.pointer > 0) {
      this.pointer--
      return JSON.parse(JSON.stringify(this.stack[this.pointer]))
    }
    return null
  }

  redo(): T | null {
    if (this.pointer < this.stack.length - 1) {
      this.pointer++
      return JSON.parse(JSON.stringify(this.stack[this.pointer]))
    }
    return null
  }

  current(): T | null {
    return this.stack[this.pointer] ?? null
  }
}
