import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { forwardRef, useId, useState } from 'react'
import { Eye, EyeSlash } from '../icons'
import { FieldError } from './FieldError'
import { Label } from './Label'

type InputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'className' | 'type'
> & {
  label?: string
  error?: string | string[]
  description?: ReactNode
}

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, description, ...props }, ref) => {
    const id = useId()
    const [isVisible, setIsVisible] = useState(false)

    return (
      <div>
        {label && (
          <Label htmlFor={id} required={props.required ?? false}>
            {label}
          </Label>
        )}
        <div className='shadow-sm relative'>
          <input
            id={id}
            ref={ref}
            type={isVisible ? 'text' : 'password'}
            className='block w-full rounded-md border border-tealish/50 transition-colors pr-10 duration-150 placeholder:font-extralight focus:border-tealish focus:outline-none focus:ring-0 disabled:bg-mercury'
            {...props}
          />

          <button
            type='button'
            onClick={() => setIsVisible(!isVisible)}
            className='absolute inset-y-0 right-0 flex items-center pr-3'
          >
            {isVisible ? (
              <EyeSlash className='h-5 w-5' />
            ) : (
              <Eye className='h-5 w-5' />
            )}
          </button>
        </div>
        {description ? (
          <div className='font-medium text-sm'>{description}</div>
        ) : null}
        <FieldError error={error} />
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'
