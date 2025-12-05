"use client"

import { AnimatePresence, motion } from "framer-motion"
import { usePathname } from "next/navigation"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={path}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
