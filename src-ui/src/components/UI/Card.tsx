import React from 'react'
import './Card.css'

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'gradient' | 'glass' | 'neon'
  hoverable?: boolean
  onClick?: () => void
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  hoverable = false,
  onClick
}) => {
  return (
    <div 
      className={`card card-${variant} ${hoverable ? 'card-hoverable' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="card-content">
        {children}
      </div>
      {variant === 'neon' && <div className="card-glow" />}
    </div>
  )
}