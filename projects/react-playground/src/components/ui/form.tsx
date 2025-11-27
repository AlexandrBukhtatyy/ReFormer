import * as React from 'react';

export interface FormProps extends React.ComponentProps<'form'> {
  className?: string;
}

const Form = React.forwardRef<HTMLFormElement, FormProps>(({ children, ...props }, ref) => {
  return (
    <form ref={ref} {...props}>
      {children}
    </form>
  );
});

Form.displayName = 'Form';

export { Form };
