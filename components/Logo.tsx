// components/Logo.tsx

export default function Logo() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-brand-primary"
    >
      {/* Outer flow loop */}
      <path
        d="M40 100C40 62 62 40 100 40C138 40 160 62 160 100C160 138 138 160 100 160"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinecap="round"
      />

      {/* Inner node */}
      <circle cx="100" cy="100" r="18" fill="currentColor" />
    </svg>
  )
}
