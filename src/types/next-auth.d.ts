  import "next-auth"

  declare module "next-auth" {
    interface Session {
      user: {
        id: string
        email?: string | null
        name?: string | null
        image?: string | null
        role?: string
        workspaces?: any[]    
        activeWorkspaceId?: string
      }
      microsoftAccessToken?: string
    }
  }

  declare module "next-auth/jwt" {
    interface JWT {
      id?: string
      userId?: string
      role?: string
      provider?: string
      workspaces?: any[]
      activeWorkspaceId?: string
      microsoftAccessToken?: string
      microsoftRefreshToken?: string
      microsoftTokenExpiry?: number
      currency?: string
      locale?: string
      timezone?: string
    }
  }
