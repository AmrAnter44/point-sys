// types/fitness-test.ts - أنواع اختبار اللياقة

export type FlexibilityLevel = 'FAIR' | 'GOOD' | 'EXCELLENT'

export type FlexibilityBodyPart =
  | 'shoulder'
  | 'hip'
  | 'elbow'
  | 'wrist'
  | 'spine'
  | 'scapula'
  | 'knee'
  | 'ankle'

export interface FlexibilityAssessment {
  shoulder: FlexibilityLevel
  hip: FlexibilityLevel
  elbow: FlexibilityLevel
  wrist: FlexibilityLevel
  spine: FlexibilityLevel
  scapula: FlexibilityLevel
  knee: FlexibilityLevel
  ankle: FlexibilityLevel
}

export interface ExerciseTest {
  sets: number
  reps: number
}

export interface ExerciseTestData {
  pushup: ExerciseTest
  situp: ExerciseTest
  pullup: ExerciseTest
  squat: ExerciseTest
  plank: ExerciseTest
  legpress: ExerciseTest
  chestpress: ExerciseTest
}

export interface MedicalQuestions {
  firstTimeGym: boolean
  inDietPlan: boolean
  hernia: boolean
  familyHeartHistory: boolean
  heartProblem: boolean
  backPain: boolean
  surgery: boolean
  breathingProblems: boolean
  bloodPressure: boolean
  kneeProblem: boolean
  diabetes: boolean
  smoker: boolean
  highCholesterol: boolean
}

export interface FitnessTestData {
  id: string
  memberId: string
  memberName: string
  memberPhone: string
  memberNumber: number
  coachId: string
  coachName: string
  testDate: string
  freePTSessions: number
  medicalQuestions: MedicalQuestions
  flexibility: FlexibilityAssessment
  exercises: ExerciseTestData
  createdAt: string
  createdBy: string
}

export interface CreateFitnessTestPayload {
  coachId: string
  testDate: string
  medicalQuestions: MedicalQuestions
  flexibility: FlexibilityAssessment
  exercises: ExerciseTestData
}
