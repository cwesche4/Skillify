import type { FC } from 'react'
import { ArrowUp, CheckCircle, ShieldQuestion, Slash } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type NodeRef = { id: string; label: string; type?: string }

type Props = {
  startNode?: NodeRef
  failureNodes?: NodeRef[]
  approvalNodes?: NodeRef[]
  onJump: (id: string) => void
}

export const FlowNavigator: FC<Props> = ({
  startNode,
  failureNodes = [],
  approvalNodes = [],
  onJump,
}) => {
  return (
    <div className="space-y-2 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-100">Quick jumps</span>
      </div>
      <div className="space-y-1 text-[12px] text-slate-200">
        <Button
          variant="subtle"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => startNode && onJump(startNode.id)}
          disabled={!startNode}
        >
          <ArrowUp className="h-4 w-4 text-slate-400" aria-hidden />
          Start node
        </Button>
        <Button
          variant="subtle"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => failureNodes[0] && onJump(failureNodes[0].id)}
          disabled={!failureNodes.length}
        >
          <Slash className="h-4 w-4 text-rose-300" aria-hidden />
          First failure
        </Button>
        <Button
          variant="subtle"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => approvalNodes[0] && onJump(approvalNodes[0].id)}
          disabled={!approvalNodes.length}
        >
          <ShieldQuestion className="h-4 w-4 text-amber-300" aria-hidden />
          First approval
        </Button>
      </div>
    </div>
  )
}

export default FlowNavigator
