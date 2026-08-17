import type { FC } from 'react'

type Props = {
  message?: string
}

export const FailureExplanation: FC<Props> = ({ message }) => {
  if (!message) return null
  return (
    <p
      className="mt-1 text-[10px] text-rose-200/80"
      title={message}
      aria-label="Failure explanation"
    >
      {message}
    </p>
  )
}

export default FailureExplanation
