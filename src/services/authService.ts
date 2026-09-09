import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { UserProfile, PendingInvite, UserRole } from '../types';

export { isSupabaseConfigured };

// Envia o magic link. Se o e-mail ainda não tem conta, o Supabase cria uma
// (shouldCreateUser: true é o padrão) — por isso o mesmo fluxo serve tanto
// para "logar" quanto para "aceitar convite" de quem o master acabou de cadastrar.
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase não configurado.' };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: window.location.origin }
  });
  return { error: error?.message ?? null };
}

// Login alternativo com senha — só funciona se a pessoa já definiu uma senha
// antes (ver setOwnPassword). Quem nunca definiu continua usando o link mágico.
export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase não configurado.' };
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  return { error: error?.message ?? null };
}

// Define/troca a senha do usuário já logado (via link mágico ou senha antiga).
// Depois disso a pessoa pode escolher entrar por link ou por senha à vontade.
export async function setOwnPassword(newPassword: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase não configurado.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

function mapProfileRow(row: any): UserProfile {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    executiveName: row.executive_name,
    createdAt: row.created_at
  };
}

// Busca o profile do usuário logado; se ainda não existir (primeiro login),
// reivindica um pending_invite pelo e-mail e cria o profile a partir dele.
// Sem convite pendente e sem profile: a pessoa logou mas ninguém a convidou —
// tratado como "sem acesso" pelo chamador.
export async function loadOrClaimOwnProfile(userId: string, email: string): Promise<UserProfile | null> {
  if (!supabase) return null;

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return mapProfileRow(existing);

  const normalizedEmail = email.trim().toLowerCase();
  const { data: invite, error: inviteError } = await supabase
    .from('pending_invites')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) return null;

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: normalizedEmail,
      role: invite.role,
      executive_name: invite.executive_name
    })
    .select('*')
    .single();
  if (insertError) throw insertError;

  await supabase.from('pending_invites').delete().eq('email', normalizedEmail);

  return mapProfileRow(created);
}

export async function listProfiles(): Promise<UserProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapProfileRow);
}

export async function listPendingInvites(): Promise<PendingInvite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('pending_invites').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    email: row.email,
    role: row.role,
    executiveName: row.executive_name,
    invitedBy: row.invited_by,
    createdAt: row.created_at
  }));
}

// Convida alguém: grava o pending_invite e dispara o magic link para o e-mail.
export async function inviteUser(params: {
  email: string;
  role: UserRole;
  executiveName: string | null;
  invitedBy: string;
}): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase não configurado.' };
  const email = params.email.trim().toLowerCase();

  const { error: insertError } = await supabase.from('pending_invites').insert({
    email,
    role: params.role,
    executive_name: params.role === 'executivo' ? params.executiveName : null,
    invited_by: params.invitedBy
  });
  if (insertError) return { error: insertError.message };

  return sendMagicLink(email);
}

export async function revokePendingInvite(email: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('pending_invites').delete().eq('email', email);
  if (error) throw error;
}

export async function updateProfileRole(id: string, role: UserRole, executiveName: string | null): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('profiles')
    .update({ role, executive_name: role === 'executivo' ? executiveName : null })
    .eq('id', id);
  if (error) throw error;
}
