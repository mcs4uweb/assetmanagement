// src/models/Group.ts
export interface GroupAdmin {
  AdminId: string;
  Email: string;
  DisplayName?: string;
  PhotoURL?: string;
}

export interface GroupMember {
  UserId: string;
  Email: string;
  DisplayName?: string;
  JoinedAt?: string;
}

export interface Group {
  GroupId: string;
  Name?: string;
  Admin: GroupAdmin;
  Members: GroupMember[];
  CreatedAt?: string;
  UpdatedAt?: string;
}

