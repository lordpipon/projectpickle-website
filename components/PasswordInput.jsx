'use client';
import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
export default function PasswordInput({ label = 'Password', name = 'password', autoComplete = 'current-password', minLength = 1 }) {
  const id = useId(); const [visible, setVisible] = useState(false);
  return <div className="field"><Label htmlFor={id}>{label}</Label><div className="password-control"><Input id={id} name={name} type={visible ? 'text' : 'password'} required minLength={minLength} maxLength={128} autoComplete={autoComplete} /><Button variant="ghost" size="icon" type="button" aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div></div>;
}
