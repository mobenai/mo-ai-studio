import pandas as pd
import logging
from pathlib import Path

# 设置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


def split_excel(input_file):
    try:
        # 读取原始Excel文件
        logging.info(f"读取文件: {input_file}")
        df = pd.read_excel(input_file)

        # 检查必要的列是否存在
        required_columns = ["问题描述", "小型改造：SM/提问 审批时间"]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"Excel文件中缺少必要的列: {col}")

        # 第一次拆分：高风险巡检
        high_risk_inspection = df[df["问题描述"].str.contains("巡检|高风险", na=False)]
        unclassified = df[~df["问题描述"].str.contains("巡检|高风险", na=False)]

        # 保存高风险巡检Excel
        high_risk_file = "高风险巡检.xlsx"
        high_risk_inspection.to_excel(high_risk_file, index=False)
        logging.info(f"已创建高风险巡检文件: {high_risk_file}")

        # 保存未分类Excel
        unclassified_file = "未分类.xlsx"
        unclassified.to_excel(unclassified_file, index=False)
        logging.info(f"已创建未分类文件: {unclassified_file}")

        # 第二次拆分：小型改造
        small_renovation = unclassified[
            unclassified["小型改造：SM/提问 审批时间"].notna()
        ]
        remaining_unclassified = unclassified[
            unclassified["小型改造：SM/提问 审批时间"].isna()
        ]

        # 保存小型改造Excel
        small_renovation_file = "小型改造.xlsx"
        small_renovation.to_excel(small_renovation_file, index=False)
        logging.info(f"已创建小型改造文件: {small_renovation_file}")

        # 更新未分类Excel
        remaining_unclassified.to_excel(unclassified_file, index=False)
        logging.info(f"已更新未分类文件: {unclassified_file}")

        logging.info("Excel拆分完成")

    except Exception as e:
        logging.error(f"处理Excel时发生错误: {str(e)}")
        raise


def main():
    input_file = 'db.xlsx'
    input_path = Path(input_file)
    
    if not input_path.exists():
        logging.error(f"输入文件不存在: {input_path}")
        return

    try:
        split_excel(input_path)
    except Exception as e:
        logging.error(f"程序执行失败: {str(e)}")


if __name__ == "__main__":
    main()