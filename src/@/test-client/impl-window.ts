import { IAudioPlayer } from '../audio-player'
import { TimeSpan } from '../time/time-span'
import { findByRole, findByTestId, type FindConfig, type ITestNode, type TestAction } from './interface'
import { isElementVisible } from './is-element-visible'

export type ImplWindowBase = {
  maxWait: TimeSpan
  poll: TimeSpan
  audioPlayer: IAudioPlayer
}

export type ImplWindow = ImplWindowBase & {
  t: 'window'
}

const init = (config: ImplWindow): ITestNode => {
  const root: ITestNode = {
    async inputValue() {
      return null
    },
    async audio() {
      return config.audioPlayer.played()
    },
    async find(selector: string, queryConfig?: FindConfig) {
      const maxWait = queryConfig?.maxWait ?? config.maxWait
      const pollInterval = queryConfig?.poll ?? config.poll
      return find(document, selector, {
        maxWait,
        pollInterval,
        onPoll: queryConfig?.onPoll ?? (() => {}),
        onDone: queryConfig?.onDone ?? (() => {}),
      })
    },
    async attr(name) {
      return document.documentElement.getAttribute(name) ?? null
    },
    // Search through root.find so lookups use the configured maxWait and poll
    // (an element node waits only 1s, too short while the suite runs in parallel).
    async findByTestId(testId) {
      return findByTestId(root, testId)
    },
    async findByRole(role, label) {
      return findByRole(root, role, label)
    },
    async text() {
      return null
    },
    async do(_action) {
      return
    },
    async isVisible() {
      return true
    },
  }
  return root
}

const find = async (
  root: Element | Document,
  selector: string,
  config: {
    maxWait: TimeSpan
    pollInterval: TimeSpan
    onPoll: () => void
    onDone: () => void
  },
): Promise<ITestNode[]> => {
  const poll = async () => {
    const found = Array.from(root.querySelectorAll(selector))
    const testNodes = found.map(elementToTestNode)
    return testNodes
  }

  const pollIntervalMs = TimeSpan.toMilliseconds(config.pollInterval)
  const maxWaitMs = TimeSpan.toMilliseconds(config.maxWait)
  const startTimeMs = Date.now()

  while (Date.now() - startTimeMs < maxWaitMs) {
    config.onPoll?.()
    const nodes = await poll()
    config.onPoll?.()
    if (nodes.length > 0) {
      return nodes
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  config.onDone?.()

  return []
}

export const elementToTestNode = (node: Element): ITestNode => {
  return {
    async inputValue() {
      if ('value' in node && typeof node.value === 'string') {
        return node.value
      }
      return null
    },
    async text() {
      return node.textContent ?? null
    },
    async attr(name: string) {
      return node.getAttribute(name) ?? null
    },
    async isVisible() {
      return isElementVisible(node)
    },
    async find(selector: string, queryConfig?: FindConfig) {
      return find(node, selector, {
        maxWait: queryConfig?.maxWait ?? TimeSpan.milliseconds(1000),
        pollInterval: queryConfig?.poll ?? TimeSpan.milliseconds(10),
        onPoll: queryConfig?.onPoll ?? (() => {}),
        onDone: queryConfig?.onDone ?? (() => {}),
      })
    },
    async findByTestId(testId) {
      return findByTestId(elementToTestNode(node), testId)
    },
    async findByRole(role, label) {
      return findByRole(elementToTestNode(node), role, label)
    },
    async audio() {
      return []
    },
    async do(action: TestAction) {
      switch (action.t) {
        case 'keydown': {
          node.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, bubbles: true }))
          break
        }
        case 'click': {
          node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          break
        }
        case 'input': {
          node.dispatchEvent(new InputEvent('input', { data: action.value, bubbles: true }))
          break
        }
        case 'change': {
          node.dispatchEvent(new Event('change', { bubbles: true }))
          break
        }
        case 'submit': {
          node.dispatchEvent(new Event('submit', { bubbles: true }))
          break
        }
      }
    },
  }
}

export const ImplWindow = {
  init,
}
