import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UserSetting {
  id: string;
  userId: string;
  settingKey: string;
  settingValue: string;
  createdAt: Date;
  updatedAt: Date;
}

// Hook to get all user settings
export function useUserSettings() {
  return useQuery<UserSetting[]>({
    queryKey: ['/api/user-settings'],
    queryFn: async () => {
      const response = await fetch('/api/user-settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch user settings: ${response.status}`);
      }
      return response.json();
    }
  });
}

// Hook to get a specific user setting
export function useUserSetting(settingKey: string) {
  return useQuery<UserSetting | undefined>({
    queryKey: ['/api/user-settings', settingKey],
    queryFn: async () => {
      const response = await fetch(`/api/user-settings/${settingKey}`);
      if (response.status === 404) {
        return undefined; // Setting doesn't exist
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch user setting: ${response.status}`);
      }
      return response.json();
    }
  });
}

// Hook to create or update a user setting
export function useUpdateUserSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ settingKey, settingValue }: { settingKey: string, settingValue: string }) => {
      const response = await fetch(`/api/user-settings/${settingKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settingValue })
      });
      if (!response.ok) {
        throw new Error(`Failed to update user setting: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all user settings queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/user-settings'] });
    }
  });
}

// Hook to delete a user setting
export function useDeleteUserSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settingKey: string) => {
      const response = await fetch(`/api/user-settings/${settingKey}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error(`Failed to delete user setting: ${response.status}`);
      }
    },
    onSuccess: () => {
      // Invalidate all user settings queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/user-settings'] });
    }
  });
}

// Utility hook to get setting value with default
export function useSettingValue(settingKey: string, defaultValue: string = '') {
  const { data: setting } = useUserSetting(settingKey);
  return setting?.settingValue ?? defaultValue;
}

// Utility hook to get boolean setting value
export function useBooleanSetting(settingKey: string, defaultValue: boolean = false) {
  const value = useSettingValue(settingKey, defaultValue.toString());
  return value === 'true';
}