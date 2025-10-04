import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // Provide a helpful message in dev console rather than a cryptic runtime error
  console.error(
    'Missing Supabase env vars. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in a .env file.'
  )
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? ''
)

/**
 * Fetches the username for the current authenticated user from the profiles table
 * @returns Object with username (null if not found) and optional error
 */
export async function getUsername(): Promise<{ username: string | null; error?: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { username: null, error: 'No authenticated user found' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    
    if (error) {
      // If no row found, that's okay - user doesn't have a username yet
      if (error.code === 'PGRST116') {
        return { username: null };
      }
      console.error('Error fetching username:', error);
      return { username: null, error };
    }
    
    return { username: data?.username ?? null };
  } catch (err) {
    console.error('Exception fetching username:', err);
    return { username: null, error: err };
  }
}

/**
 * Updates or inserts the username for the current authenticated user
 * @param username - The username to set
 * @returns Object with success status and optional error
 */
export async function updateUsername(username: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'No authenticated user found' };
    }

    // Set or change username (UPSERT by id)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username }, { onConflict: 'id' });
    
    if (error) {
      // If the username is taken (unique index), you'll get a constraint error
      console.error('Error updating username:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Exception updating username:', err);
    return { success: false, error: err };
  }
}

/**
 * Inserts a new attempt record into the database
 * @param height - The height achieved in meters
 * @param flips - The number of flips achieved
 * @returns Object with success status and optional error
 */
export async function insertAttempt(
  height: number, 
  flips: number
): Promise<{ success: boolean; error?: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'No authenticated user found' };
    }

    const { error } = await supabase
      .from('attempts')
      .insert({ 
        user_id: user.id, 
        height, 
        flips
      });
    
    if (error) {
      console.error('Error inserting attempt:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Exception inserting attempt:', err);
    return { success: false, error: err };
  }
}

/**
 * Fetches the top personal records by height from the profiles table
 * @param limit - Maximum number of records to return (default: 100)
 * @returns Object with top height PRs and optional error
 */
export async function getTopHeightPRs(limit: number = 100): Promise<{ 
  data: any[] | null; 
  error?: any 
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, height_pr')
      .not('height_pr', 'is', null)
      .order('height_pr', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching top height PRs:', error);
      return { data: null, error };
    }
    
    return { data: data ?? [] };
  } catch (err) {
    console.error('Exception fetching top height PRs:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetches the top personal records by flips from the profiles table
 * @param limit - Maximum number of records to return (default: 100)
 * @returns Object with top flips PRs and optional error
 */
export async function getTopFlipsPRs(limit: number = 100): Promise<{ 
  data: any[] | null; 
  error?: any 
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, flips_pr')
      .not('flips_pr', 'is', null)
      .order('flips_pr', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching top flips PRs:', error);
      return { data: null, error };
    }
    
    return { data: data ?? [] };
  } catch (err) {
    console.error('Exception fetching top flips PRs:', err);
    return { data: null, error: err };
  }
}