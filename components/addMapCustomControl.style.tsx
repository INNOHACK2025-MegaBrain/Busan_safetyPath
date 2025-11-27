export default function AddMapCustomControlStyle() {
  return (
    <style>{`
      .map_wrap {
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 350px;
      }
      .radius_border {
        border: 1px solid #919191;
        border-radius: 5px;
      }
      .custom_typecontrol {
        position: absolute;
        top: 10px;
        right: 10px;
        overflow: hidden;
        width: 130px;
        height: 30px;
        margin: 0;
        padding: 0;
        z-index: 1;
        font-size: 12px;
        font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        display: flex;
      }
      .custom_typecontrol span {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 65px;
        height: 30px;
        text-align: center;
        line-height: 30px;
        cursor: pointer;
        user-select: none;
      }
      .custom_typecontrol .btn {
        background: #fff;
        background: linear-gradient(#fff, #e6e6e6);
      }
      .custom_typecontrol .btn:hover {
        background: #f5f5f5;
        background: linear-gradient(#f5f5f5, #e3e3e3);
      }
      .custom_typecontrol .btn:active {
        background: #e6e6e6;
        background: linear-gradient(#e6e6e6, #fff);
      }
      .custom_typecontrol .selected_btn {
        color: #fff;
        background: #425470;
        background: linear-gradient(#425470, #5b6d8a);
      }
      .custom_typecontrol .selected_btn:hover {
        color: #fff;
      }
      .custom_zoomcontrol {
        position: absolute;
        top: 50px;
        right: 10px;
        width: 36px;
        height: 80px;
        overflow: hidden;
        z-index: 1;
        background-color: #f5f5f5;
        display: flex;
        flex-direction: column;
      }
      .custom_zoomcontrol span {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 40px;
        text-align: center;
        cursor: pointer;
        user-select: none;
      }
      .custom_zoomcontrol span img,
      .custom_zoomcontrol span svg {
        width: 15px;
        height: 15px;
        padding: 12px 0;
        border: none;
        color: #333;
      }
      .custom_zoomcontrol span:hover svg {
        color: #000;
      }
      .custom_zoomcontrol span:first-child {
        border-bottom: 1px solid #bfbfbf;
      }
    `}</style>
  );
}
