// Catches anything thrown while drawing the app and shows the plain "can't start" screen, so the
// page is never blank. React reports the error to the console itself.

import { Component, type ReactNode } from 'react'
import { Unavailable } from './Unavailable'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <Unavailable /> : this.props.children
  }
}
