// NoSubmissionRecord.d.ts
// 扩展 ScoreRecord 类型，添加未上传标记

// 不需要导入，直接声明模块
declare module './utils/scoreCalculator' {
  export interface ScoreRecord {
    isNoSubmission?: boolean;
  }
}
