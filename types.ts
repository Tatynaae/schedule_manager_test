export type WeekDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
export type RoomType = 'LECTURE' | 'COMPUTER_LAB';

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
}

export interface Teacher {
  id: string;
  name: string;
  shortName: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: RoomType;
}

export interface Section {
  id: string;
  courseId: string;
  code: string;
  studentsCount: number;
  requiredLessonsPerWeek: number;
  teacherId: string | null;
  allowedTeacherIds: string[];
  preferredRoomType: RoomType;
}

export interface TeacherBlockedSlot {
  teacherId: string;
  day: WeekDay;
  timeSlotId: string;
  reason: string;
}

export interface Lesson {
  id: string;
  sectionId: string;
  teacherId: string;
  roomId: string;
  day: WeekDay;
  timeSlotId: string;
}
